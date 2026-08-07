import { logger } from '../utils/logger';
import type { MCPServerConfig } from '../store/useMCPStore';
import type { ToolResult, MCPStructuredResult } from './tools/types';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPClientEvents {
  onToolsChanged?: (tools: MCPToolDefinition[]) => void;
}

interface MCPClientHandle {
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
  callTool(params: { name: string; arguments: Record<string, unknown> }, options?: Record<string, unknown>, requestOptions?: Record<string, unknown>): Promise<{ content: Array<{ type: string; text?: string; resource?: Record<string, unknown> }>; isError?: boolean }>;
  listTools(): Promise<{ tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>;
}

export class MCPClient {
  private _client: MCPClientHandle | null = null;
  private _transport: unknown = null;
  private _tools: MCPToolDefinition[] = [];
  private _config: MCPServerConfig;
  private _events: MCPClientEvents;
  private _disposed = false;

  constructor(config: MCPServerConfig, events?: MCPClientEvents) {
    this._config = config;
    this._events = events || {};
  }

  get serverId(): string {
    return this._config.id;
  }

  get tools(): MCPToolDefinition[] {
    return this._tools;
  }

  async connect(): Promise<void> {
    if (this._disposed) throw new Error('Client disposed');
    if (this._client) return;

    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client');
      let transport: unknown;

      if (this._config.transport === 'sse') {
        transport = await this._createSSETransport();
      } else if (this._config.transport === 'stdio') {
        transport = await this._createStdioTransport();
      } else {
        throw new Error(`Unsupported transport: ${this._config.transport}`);
      }

      this._client = new Client(
        { name: 'GIA', version: '2.3.3.0-beta.1' },
        { capabilities: {} }
      ) as unknown as MCPClientHandle;

      await this._client.connect(transport);
      this._transport = transport;

      await this._refreshTools();
    } catch (err) {
      this._client = null;
      this._transport = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._disposed = true;
    try {
      if (this._client) {
        await this._client.close().catch((e) => { logger.error('[MCPClient] Failed to close client:', e); });
      }
    } finally {
      this._client = null;
      this._transport = null;
      this._tools = [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this._client) {
      return { success: false, content: 'MCP client not connected' };
    }

    try {
      const result = await this._client.callTool(
        { name, arguments: args },
        {},
        {
          onprogress: undefined,
        }
      );

      // Check for structured results (resources with mime types)
      const structuredResults: MCPStructuredResult[] = [];
      let textContent = '';

      if (result.content) {
        for (const part of result.content) {
          if (part.type === 'text') {
            textContent += part.text + '\n';
          } else if (part.type === 'resource' && part.resource) {
            const r = part.resource as Record<string, unknown>;
            const mimeType = typeof r.mimeType === 'string' ? r.mimeType : 'application/octet-stream';
            const blobData = r.blob as string | undefined;
            const textData = r.text as string | undefined;
            const data = blobData || textData || '';
            const metadata = {
              title: (typeof r.title === 'string' ? r.title : undefined) || (typeof r.name === 'string' ? r.name : undefined) || (typeof r.uri === 'string' ? r.uri : undefined),
              description: typeof r.description === 'string' ? r.description : undefined,
            };
            structuredResults.push({
              contentType: mimeType as MCPStructuredResult['contentType'],
              data: blobData ? Uint8Array.from(atob(blobData), c => c.charCodeAt(0)) : data,
              metadata,
              encoding: blobData ? 'base64' : 'utf-8',
            });
          }
        }
      }

      return {
        success: !result.isError,
        content: textContent || '',
        structuredResult: structuredResults.length === 1 ? structuredResults[0] : structuredResults.length > 1 ? structuredResults : undefined,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: `MCP tool error: ${msg}` };
    }
  }

  private async _createSSETransport(): Promise<unknown> {
    const url = this._config.url;
    if (!url) throw new Error('SSE URL is required');

    const { SSEClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/sse'
    ) as unknown as { SSEClientTransport: new (url: URL) => unknown };

    return new SSEClientTransport(new URL(url));
  }

  private async _createStdioTransport(): Promise<unknown> {
    const { command, args } = this._config;
    if (!command) throw new Error('Stdio command is required');

    try {
      const { StdioClientTransport } = await import(
        /* @vite-ignore */
        '@modelcontextprotocol/sdk/client/stdio'
      ) as unknown as { StdioClientTransport: new (opts: { command: string; args: string[] }) => unknown };
      return new StdioClientTransport({
        command,
        args: args || [],
      });
    } catch {
      // Fallback: Try GIA Stdio Bridge SSE on localhost:3080
      try {
        const bridgeRes = await fetch('http://localhost:3080/health', { signal: AbortSignal.timeout(1500) });
        if (bridgeRes.ok) {
          const { SSEClientTransport } = await import(
            '@modelcontextprotocol/sdk/client/sse'
          ) as unknown as { SSEClientTransport: new (url: URL) => unknown };
          return new SSEClientTransport(new URL('http://localhost:3080/sse'));
        }
      } catch {
        /* Bridge unavailable */
      }

      throw new Error(
        `Stdio transport for "${command}" requires Node.js or GIA Stdio Bridge. ` +
        'For mobile/web, please use SSE transport or enable GIA Stdio Bridge.'
      );
    }
  }

  private async _refreshTools(): Promise<void> {
    if (!this._client) return;

    try {
      const result = await this._client.listTools();
      this._tools = (result.tools || []).map((t) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: (t.inputSchema as Record<string, unknown>) || {},
      }));
      this._events.onToolsChanged?.(this._tools);
    } catch (err) {
      logger.warn(`[MCP] Failed to list tools for ${this._config.name}:`, err);
      this._tools = [];
    }
  }
}
