import type { MCPServerConfig, MCPConnectionState } from '../store/useMCPStore';
import type { ToolResult } from './GiaTools';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface MCPClientEvents {
  onToolsChanged?: (tools: MCPToolDefinition[]) => void;
}

export class MCPClient {
  private _client: any = null;
  private _transport: any = null;
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
      let transport: any;

      if (this._config.transport === 'sse') {
        transport = await this._createSSETransport();
      } else if (this._config.transport === 'stdio') {
        transport = await this._createStdioTransport();
      } else {
        throw new Error(`Unsupported transport: ${this._config.transport}`);
      }

      this._client = new Client(
        { name: 'GIA', version: '2.3.1.0' },
        { capabilities: {} }
      );

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
        await this._client.close().catch(() => {});
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

      const content = result.content
        ? result.content
            .map((part: any) => {
              if (part.type === 'text') return part.text;
              if (part.type === 'resource') return `[Resource: ${part.resource?.text || part.resource?.uri || ''}]`;
              return JSON.stringify(part);
            })
            .filter(Boolean)
            .join('\n')
        : JSON.stringify(result);

      return {
        success: !result.isError,
        content,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, content: `MCP tool error: ${msg}` };
    }
  }

  private async _createSSETransport(): Promise<any> {
    const url = this._config.url;
    if (!url) throw new Error('SSE URL is required');

    const { SSEClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/sse'
    ) as any;

    return new SSEClientTransport(new URL(url));
  }

  private async _createStdioTransport(): Promise<any> {
    const { command, args } = this._config;
    if (!command) throw new Error('Stdio command is required');

    try {
      const { StdioClientTransport } = await import(
        /* @vite-ignore */
        '@modelcontextprotocol/sdk/client/stdio'
      ) as any;
      return new StdioClientTransport({
        command,
        args: args || [],
      });
    } catch {
      throw new Error(
        'Stdio transport is only available in Node.js environments. ' +
        'Use SSE transport for browser/mobile, or run GIA in a Node.js backend.'
      );
    }
  }

  private async _refreshTools(): Promise<void> {
    if (!this._client) return;

    try {
      const result = await this._client.listTools();
      this._tools = (result.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: (t.inputSchema as Record<string, unknown>) || {},
      }));
      this._events.onToolsChanged?.(this._tools);
    } catch (err) {
      console.warn(`[MCP] Failed to list tools for ${this._config.name}:`, err);
      this._tools = [];
    }
  }
}
