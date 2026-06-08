import { logger } from '../utils/logger';
import { MCPClient, type MCPToolDefinition } from './MCPClient';
import { useMCPStore } from '../store/useMCPStore';
import GiaTools from './GiaTools';

class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolToServer: Map<string, string> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const store = useMCPStore.getState();
    const servers = store.servers;

    // Auto-detect GIA Stdio Bridge at localhost:3080
    this._detectBridge(store);

    for (const server of servers) {
      if (server.enabled && server.autoConnect) {
        this.connect(server.id).catch((e) => { logger.error('[MCPManager] Auto-connect failed for server:', e); });
      }
    }
  }

  private async _detectBridge(store: ReturnType<typeof useMCPStore.getState>): Promise<void> {
    try {
      const res = await fetch('http://localhost:3080/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const existing = store.servers.find(s => s.id === 'mcp-local-bridge');
        if (existing && !existing.enabled) {
          store.updateServer('mcp-local-bridge', { enabled: true });
        }
      }
    } catch (e) {
      logger.warn('[MCPManager] Bridge not detected, leaving server disabled:', e);
    }
  }

  async connect(serverId: string): Promise<void> {
    const store = useMCPStore.getState();
    const config = store.getServer(serverId);
    if (!config) throw new Error(`Server ${serverId} not found`);

    const existing = this.clients.get(serverId);
    if (existing) {
      await existing.disconnect().catch((e) => { logger.error('[MCPManager] Failed to disconnect existing client:', e); });
      this.clients.delete(serverId);
    }

    store.setConnectionState(serverId, { status: 'connecting', toolCount: 0 });

    const client = new MCPClient(config, {
      onToolsChanged: (tools) => this._onToolsChanged(serverId, tools),
    });

    try {
      await client.connect();
      this.clients.set(serverId, client);
      store.setConnectionState(serverId, {
        status: 'connected',
        toolCount: client.tools.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      store.setConnectionState(serverId, {
        status: 'error',
        error: msg,
        toolCount: 0,
      });
      throw err;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      this._unregisterServerTools(serverId);
      await client.disconnect().catch((e) => { logger.error('[MCPManager] Failed to disconnect client:', e); });
      this.clients.delete(serverId);
    }
    useMCPStore.getState().setConnectionState(serverId, {
      status: 'disconnected',
      toolCount: 0,
    });
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<{ success: boolean; content: string }> {
    const serverId = this.toolToServer.get(toolName);
    if (!serverId) {
      return { success: false, content: `MCP tool "${toolName}" not found on any connected server` };
    }

    const client = this.clients.get(serverId);
    if (!client) {
      return { success: false, content: `MCP server "${serverId}" is not connected` };
    }

    return client.callTool(toolName, args);
  }

  getConnectedServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  getToolNames(): string[] {
    return Array.from(this.toolToServer.keys());
  }

  isConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  async shutdown(): Promise<void> {
    for (const [id] of this.clients) {
      await this.disconnect(id).catch((e) => { logger.error('[MCPManager] Failed to disconnect during shutdown:', e); });
    }
    this.initialized = false;
  }

  private _onToolsChanged(serverId: string, tools: MCPToolDefinition[]): void {
    this._unregisterServerTools(serverId);

    for (const tool of tools) {
      const toolId = `mcp__${serverId}__${tool.name}`;
      this.toolToServer.set(toolId, serverId);

      const properties = (tool.inputSchema?.properties as Record<string, unknown>) || {};
      GiaTools.registerTool({
        id: toolId,
        name: toolId,
        description: `[MCP:${serverId}] ${tool.description}`,
        schema: {
          type: 'object',
          properties,
          required: (tool.inputSchema?.required as string[]) || [],
        },
        execute: async (args) => this.callTool(toolId, args),
      });
    }
  }

  private _unregisterServerTools(serverId: string): void {
    const toRemove: string[] = [];
    for (const [toolId, sid] of this.toolToServer) {
      if (sid === serverId) {
        toRemove.push(toolId);
      }
    }
    for (const toolId of toRemove) {
      this.toolToServer.delete(toolId);
      GiaTools.unregisterTool(toolId);
    }
  }
}

export default new MCPManager();
