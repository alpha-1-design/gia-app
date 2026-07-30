import { logger } from '../utils/logger';
import { MCPClient, type MCPToolDefinition } from './MCPClient';
import { useMCPStore, type MCPServerConfig } from '../store/useMCPStore';
import GiaTools from './GiaTools';
import { Browser } from '@capacitor/browser';

class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolToServer: Map<string, string> = new Map();
  private initialized = false;
  private pendingAuth: Map<string, { resolve: (v: boolean) => void; reject: (e: Error) => void }> = new Map();
  private codeVerifiers: Map<string, { serverId: string; verifier: string }> = new Map();

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

    // Check if OAuth is configured and we need to authenticate
    if (config.oauthUrl && config.oauthClientId && !config.accessToken) {
      store.setConnectionState(serverId, { status: 'connecting', toolCount: 0, error: 'Authentication required' });
      const authenticated = await this._startOAuthFlow(config);
      if (!authenticated) {
        store.setConnectionState(serverId, { status: 'disconnected', toolCount: 0, error: 'Authentication cancelled' });
        return;
      }
      // Refresh config with new tokens
      const updatedConfig = store.getServer(serverId);
      if (!updatedConfig?.accessToken) {
        store.setConnectionState(serverId, { status: 'disconnected', toolCount: 0, error: 'Authentication failed' });
        return;
      }
    }

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

  private async _startOAuthFlow(config: MCPServerConfig): Promise<boolean> {
    if (!config.oauthUrl) {
      logger.error('[MCPManager] oauthUrl is required for OAuth flow');
      return false;
    }
    if (!config.oauthClientId) {
      logger.error('[MCPManager] oauthClientId is required for OAuth flow');
      return false;
    }
    const state = crypto.randomUUID();
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = await this._generateCodeChallenge(codeVerifier);

    const authUrl = new URL(config.oauthUrl);
    authUrl.searchParams.set('client_id', config.oauthClientId);
    authUrl.searchParams.set('redirect_uri', config.oauthRedirectUri || 'gia://mcp-oauth-callback');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.oauthScopes || 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return new Promise((resolve, reject) => {
      this.pendingAuth.set(state, { resolve, reject });

      // Store code verifier for later token exchange
      this.codeVerifiers.set(state, { serverId: config.id, verifier: codeVerifier });

      // Open browser for OAuth
      (async () => {
        try {
          await Browser.open({ url: authUrl.toString() });
        } catch (e) {
          logger.error('[MCPManager] Failed to open browser for OAuth:', e);
          this.pendingAuth.delete(state);
          reject(e as Error);
        }
      })();

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingAuth.has(state)) {
          this.pendingAuth.delete(state);
          reject(new Error('OAuth timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  private _generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async _generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async handleOAuthCallback(url: string): Promise<void> {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    const pending = this.pendingAuth.get(state || '');
    if (!pending) {
      logger.warn('[MCPManager] No pending auth for state:', state);
      return;
    }

    this.pendingAuth.delete(state || '');

    if (error) {
      pending.reject(new Error(`OAuth error: ${error}`));
      return;
    }

    if (!code) {
      pending.reject(new Error('No authorization code received'));
      return;
    }

    // Find the server that matches this state
    const store = useMCPStore.getState();
    const servers = store.servers;
    const pendingEntry = this.codeVerifiers.get(state || '');
    if (!pendingEntry) {
      pending.reject(new Error('No pending OAuth entry found'));
      return;
    }
    const server = servers.find(s => s.id === pendingEntry.serverId);
    if (!server) {
      pending.reject(new Error('No server found for OAuth callback'));
      return;
    }
    const codeVerifier = pendingEntry.verifier;
    this.codeVerifiers.delete(state || '');

    try {
      if (!server.oauthUrl) {
        pending.reject(new Error('Server has no oauthUrl configured'));
        return;
      }
      const tokenUrl = new URL(server.oauthUrl);
      tokenUrl.searchParams.set('grant_type', 'authorization_code');
      tokenUrl.searchParams.set('code', code);
      tokenUrl.searchParams.set('redirect_uri', server.oauthRedirectUri || 'gia://mcp-oauth-callback');
      tokenUrl.searchParams.set('client_id', server.oauthClientId || '');
      tokenUrl.searchParams.set('code_verifier', codeVerifier);

      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokens = await response.json();
      store.setTokens(server.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });

      pending.resolve(true);
      // Retry connection
      this.connect(server.id).catch(e => logger.error('[MCPManager] Reconnect after OAuth failed:', e));
    } catch (e) {
      logger.error('[MCPManager] OAuth token exchange failed:', e);
      pending.reject(e as Error);
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

  getConnectedTools(): { id: string; name: string; description: string; serverId: string; inputSchema: Record<string, unknown> }[] {
    const tools: { id: string; name: string; description: string; serverId: string; inputSchema: Record<string, unknown> }[] = [];
    for (const [serverId, client] of this.clients) {
      for (const tool of client.tools) {
        tools.push({
          id: `mcp__${serverId}__${tool.name}`,
          name: tool.name,
          description: tool.description || '',
          serverId,
          inputSchema: tool.inputSchema || {},
        });
      }
    }
    return tools;
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
