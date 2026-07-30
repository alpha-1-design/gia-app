import React, { useState, useEffect } from 'react';
import { Plus, X, Power, PowerOff, Loader2, Globe, Terminal, Lock, PlugZap } from 'lucide-react';
import { useMCPStore, type MCPServerConfig, type MCPStoreState } from '../../store/useMCPStore';
import MCPManager from '../../services/MCPManager';
import { SubPageHeader } from './SubPageHeader';

export const MCPPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const servers = useMCPStore((s: MCPStoreState) => s.servers);
  const connections = useMCPStore((s: MCPStoreState) => s.connections);
  const addServer = useMCPStore((s: MCPStoreState) => s.addServer);
  const removeServer = useMCPStore((s: MCPStoreState) => s.removeServer);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTransport, setNewTransport] = useState<'sse' | 'stdio'>('sse');
  const [newUrl, setNewUrl] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newOAuthUrl, setNewOAuthUrl] = useState('');
  const [newOAuthClientId, setNewOAuthClientId] = useState('');
  const [newOAuthRedirectUri, setNewOAuthRedirectUri] = useState('gia://mcp-oauth-callback');
  const [newOAuthScopes, setNewOAuthScopes] = useState('openid profile email');
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    MCPManager.init().catch((e) => { console.error('[MCPPage] MCPManager init failed:', e); });
  }, []);

  const handleConnect = async (id: string) => {
    setConnecting(id);
    try {
      await MCPManager.connect(id);
    } catch { /* Error state set in MCPManager */ }
    setConnecting(null);
  };

  const handleDisconnect = async (id: string) => {
    await MCPManager.disconnect(id);
  };

  const addQuickServer = (preset: { name: string; transport: 'stdio' | 'sse'; command: string; args: string[]; env?: string; desc: string }) => {
    const name = `MCP ${preset.name}`;
    const transport = preset.transport;
    const command = preset.command;
    const args = preset.args;
    const url = '';
    const oauthUrl = '';
    const oauthClientId = '';
    const oauthRedirectUri = '';
    const oauthScopes = '';
    const enabled = false;
    const autoConnect = false;
    addServer({ name, transport, url, command, args, oauthUrl, oauthClientId, oauthRedirectUri, oauthScopes, enabled, autoConnect });
  };

  const handleAdd = () => {
    if (newTransport === 'sse' && !newUrl.trim()) return;
    if (newTransport === 'stdio' && !newCommand.trim()) return;
    const fallbackName = newTransport === 'sse' ? newUrl.trim() : newCommand.trim();
    addServer({
      name: newName.trim() || fallbackName,
      transport: newTransport,
      url: newTransport === 'sse' ? newUrl.trim() : '',
      command: newTransport === 'stdio' ? newCommand.trim() : '',
      args: newTransport === 'stdio' && newArgs.trim() ? newArgs.split(' ').filter(Boolean) : [],
      enabled: false,
      autoConnect: false,
      oauthUrl: newOAuthUrl.trim() || undefined,
      oauthClientId: newOAuthClientId.trim() || undefined,
      oauthRedirectUri: newOAuthRedirectUri.trim() || undefined,
      oauthScopes: newOAuthScopes.trim() || undefined,
    });
    setNewName('');
    setNewUrl('');
    setNewCommand('');
    setNewArgs('');
    setNewOAuthUrl('');
    setNewOAuthClientId('');
    setNewOAuthRedirectUri('gia://mcp-oauth-callback');
    setNewOAuthScopes('openid profile email');
    setShowAdd(false);
  };

  const connectedCount = servers.filter((s: MCPServerConfig) => connections[s.id]?.status === 'connected').length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="MCP Servers" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: '#a855f7' }}>About MCP Servers</p>
        <p className="mb-2">MCP (Model Context Protocol) servers extend GIA's capabilities by connecting to external tools, data sources, and services. Each server supports SSE (HTTP) or stdio (local process) transports.</p>
        <p className="mb-2">Open-source MCP servers to try: <strong style={{ color: '#a855f7' }}>Filesystem</strong> (local file access), <strong style={{ color: '#a855f7' }}>GitHub</strong> (repos + issues), <strong style={{ color: '#a855f7' }}>Slack</strong> (messaging), <strong style={{ color: '#a855f7' }}>PostgreSQL</strong> (databases), <strong style={{ color: '#a855f7' }}>Fetch</strong> (web fetching).</p>
        <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>OAuth-enabled servers support authentication flows. Click "Auth" on any OAuth-configured server to connect via your browser.</p>
      </div>

      {/* Popular Open-Source MCP Servers - Quick Add */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { name: 'Filesystem', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/gia'], desc: 'Local file access' },
          { name: 'GitHub', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: 'GITHUB_PERSONAL_ACCESS_TOKEN', desc: 'GitHub repos & issues' },
          { name: 'Fetch', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], desc: 'Web fetching' },
          { name: 'PostgreSQL', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'], env: 'POSTGRES_CONNECTION_STRING', desc: 'PostgreSQL databases' },
          { name: 'Slack', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: 'SLACK_BOT_TOKEN', desc: 'Slack messaging' },
          { name: 'Memory', transport: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], desc: 'Knowledge graph memory' },
        ].map((preset, i) => (
          <button key={i} onClick={() => addQuickServer(preset)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
            <Plus size={12} /> {preset.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-1">
        <PlugZap size={14} style={{ color: '#a855f7' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Servers ({connectedCount}/{servers.length} connected)</span>
      </div>

      {servers.length === 0 && (
        <div className="text-center py-8 text-xs" style={{ color: 'var(--gia-muted)' }}>
          No MCP servers configured. Click "Add Server" to get started.
        </div>
      )}

      {servers.map((server: MCPServerConfig) => {
        const conn = connections[server.id];
        const status = conn?.status || 'disconnected';

        return (
          <div key={server.id} className="gia-card p-4" style={{ borderLeft: `3px solid ${status === 'connected' ? '#22c55e' : status === 'error' ? '#ef4444' : 'var(--gia-border)'}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {server.transport === 'sse' ? <Globe size={14} style={{ color: '#a855f7' }} /> : <Terminal size={14} style={{ color: '#f59e0b' }} />}
                <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{server.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {status === 'connected' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Connected</span>}
                {status === 'connecting' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Loader2 size={10} className="animate-spin" />Connecting</span>}
                {status === 'error' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Error</span>}
                {status === 'disconnected' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--gia-muted)' }}>Offline</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {status !== 'connected' && status !== 'connecting' && (
                <button onClick={() => handleConnect(server.id)} disabled={connecting === server.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                  {connecting === server.id ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                  Connect
                </button>
              )}
              {status === 'connected' && (
                <button onClick={() => handleDisconnect(server.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                  <PowerOff size={12} /> Disconnect
                </button>
              )}
              {server.oauthUrl && (
                <button onClick={() => MCPManager.connect(server.id)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                  <Lock size={12} /> Auth
                </button>
              )}
              <button onClick={() => removeServer(server.id)}
                className="ml-auto p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--gia-muted)' }}>
                <X size={14} />
              </button>
            </div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--gia-muted-2)' }}>
              Transport: {server.transport} · {server.url ? `URL: ${server.url}` : server.command ? `CMD: ${server.command}` : 'No config'}
            </div>
          </div>
        );
      })}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 justify-center w-full py-3 rounded-xl border border-dashed transition-colors"
          style={{ borderColor: 'var(--gia-border)', color: 'var(--gia-muted)' }}>
          <Plus size={16} /> Add Server
        </button>
      )}

      {showAdd && (
        <div className="gia-card p-4" style={{ border: '1px solid var(--gia-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Add MCP Server</span>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-white/5" style={{ color: 'var(--gia-muted)' }}>
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--gia-muted)' }}>Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My MCP Server" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
            </div>

            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--gia-muted)' }}>Transport</label>
              <div className="flex gap-2">
                {(['sse', 'stdio'] as const).map(t => {
                  const isActive = newTransport === t;
                  return (
                    <button key={t} onClick={() => setNewTransport(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'ring-1 ring-offset-1 ring-violet-500' : ''}`}
                      style={isActive ? { background: 'rgba(168,85,247,0.2)', color: '#a855f7' } : { background: 'var(--gia-surface)', color: 'var(--gia-muted)' }}>
                      {t === 'sse' ? <Globe size={12} className="inline mr-1" /> : <Terminal size={12} className="inline mr-1" />}{t.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {newTransport === 'sse' && (
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--gia-muted)' }}>URL *</label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com/mcp" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
              </div>
            )}

            {newTransport === 'stdio' && (
              <>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--gia-muted)' }}>Command *</label>
                  <input value={newCommand} onChange={e => setNewCommand(e.target.value)} placeholder="npx -y @modelcontextprotocol/server-filesystem" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: 'var(--gia-muted)' }}>Args (space-separated)</label>
                  <input value={newArgs} onChange={e => setNewArgs(e.target.value)} placeholder="/path/to/data" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
                </div>
              </>
            )}

            <div className="border-t pt-3" style={{ borderColor: 'var(--gia-border)' }}>
              <label className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: '#3b82f6' }}>
                <Lock size={12} /> OAuth Configuration (optional)
              </label>
              <div className="space-y-2">
                <input value={newOAuthUrl} onChange={e => setNewOAuthUrl(e.target.value)} placeholder="OAuth Authorization URL" className="w-full rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
                <input value={newOAuthClientId} onChange={e => setNewOAuthClientId(e.target.value)} placeholder="Client ID" className="w-full rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
                <input value={newOAuthRedirectUri} onChange={e => setNewOAuthRedirectUri(e.target.value)} placeholder="Redirect URI" className="w-full rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
                <input value={newOAuthScopes} onChange={e => setNewOAuthScopes(e.target.value)} placeholder="Scopes" className="w-full rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', outline: 'none' }} />
              </div>
            </div>

            <button onClick={handleAdd}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#a855f7', color: '#fff' }}>
              Add Server
            </button>
          </div>
        </div>
      )}
    </div>
  );
};