import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Power, PowerOff, Wifi, WifiOff, Loader2, Server, Globe, Terminal, ExternalLink } from 'lucide-react';
import { useMCPStore, MCPServerConfig, MCPConnectionState } from '../store/useMCPStore';
import MCPManager from '../services/MCPManager';

const isNodeEnvironment = typeof process !== 'undefined' && process.versions?.node;

const MCPSettings: React.FC = () => {
  const servers = useMCPStore(s => s.servers);
  const connections = useMCPStore(s => s.connections);
  const addServer = useMCPStore(s => s.addServer);
  const removeServer = useMCPStore(s => s.removeServer);
  const updateServer = useMCPStore(s => s.updateServer);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTransport, setNewTransport] = useState<'sse' | 'stdio'>('sse');
  const [newUrl, setNewUrl] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    MCPManager.init().catch(() => {});
  }, []);

  const handleConnect = async (id: string) => {
    setConnecting(id);
    try {
      await MCPManager.connect(id);
    } catch {
      // Error state set in MCPManager
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await MCPManager.disconnect(id);
  };

  const handleAdd = () => {
    if (newTransport === 'sse' && !newUrl.trim()) return;
    if (newTransport === 'stdio' && !newCommand.trim()) return;

    addServer({
      name: newName.trim() || (newTransport === 'sse' ? newUrl.trim() : newCommand.trim()),
      transport: newTransport,
      url: newUrl.trim(),
      command: newCommand.trim(),
      args: newArgs.split(' ').filter(Boolean),
      enabled: true,
      autoConnect: false,
    });

    setNewName('');
    setNewUrl('');
    setNewCommand('');
    setNewArgs('');
    setShowAdd(false);
  };

  const connState = (id: string): MCPConnectionState =>
    connections[id] || { status: 'disconnected', toolCount: 0 };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
          MCP Servers
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
          style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
        >
          <Plus size={11} />
          Add Server
        </button>
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
        Connect to MCP servers to extend GIA with additional tools.
        {!isNodeEnvironment && (
          <span className="block mt-1">
            <Terminal size={10} className="inline mr-1" />
            For local servers, use <code className="px-1 rounded" style={{ background: 'rgba(255,255,255,0.06)' }}>npx supergateway</code> to expose stdio servers as SSE.
          </span>
        )}
      </p>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Server name (optional)"
                className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewTransport('sse')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all flex-1 justify-center"
                  style={{
                    background: newTransport === 'sse' ? 'rgba(59,130,246,0.15)' : 'var(--gia-surface)',
                    color: newTransport === 'sse' ? '#60a5fa' : 'var(--gia-muted)',
                    border: `1px solid ${newTransport === 'sse' ? 'rgba(59,130,246,0.3)' : 'var(--gia-border)'}`,
                  }}
                >
                  <Globe size={11} /> SSE
                </button>
                <button
                  type="button"
                  onClick={() => setNewTransport('stdio')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all flex-1 justify-center"
                  style={{
                    background: newTransport === 'stdio' ? 'rgba(16,185,129,0.15)' : 'var(--gia-surface)',
                    color: newTransport === 'stdio' ? '#34d399' : 'var(--gia-muted)',
                    border: `1px solid ${newTransport === 'stdio' ? 'rgba(16,185,129,0.3)' : 'var(--gia-border)'}`,
                  }}
                >
                  <Terminal size={11} /> Stdio
                </button>
              </div>

              {newTransport === 'sse' ? (
                <input
                  type="text"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="wss://my-mcp-server.com/sse"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
                />
              ) : (
                <>
                  <input
                    type="text"
                    value={newCommand}
                    onChange={e => setNewCommand(e.target.value)}
                    placeholder="npx"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
                  />
                  <input
                    type="text"
                    value={newArgs}
                    onChange={e => setNewArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-filesystem /path"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
                  />
                </>
              )}

              <button
                type="button"
                onClick={handleAdd}
                disabled={newTransport === 'sse' ? !newUrl.trim() : !newCommand.trim()}
                className="w-full py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
              >
                Add Server
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        {servers.length === 0 && (
          <p className="text-[10px] text-center py-4" style={{ color: 'var(--gia-muted-2)' }}>
            No MCP servers configured. Add one to extend GIA's capabilities.
          </p>
        )}

        {servers.map((server) => {
          const state = connState(server.id);
          const isBusy = connecting === server.id || state.status === 'connecting';

          return (
            <motion.div
              key={server.id}
              layout
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: server.transport === 'sse' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                  color: server.transport === 'sse' ? '#60a5fa' : '#34d399',
                }}
              >
                {server.transport === 'sse' ? <Globe size={11} /> : <Terminal size={11} />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--gia-text)' }}>
                  {server.name}
                </p>
                <p className="text-[9px] truncate" style={{ color: 'var(--gia-muted-2)' }}>
                  {server.transport === 'sse' ? server.url : `${server.command} ${server.args.join(' ')}`}
                  {state.toolCount > 0 && (
                    <span className="ml-1" style={{ color: '#34d399' }}>
                      · {state.toolCount} tools
                    </span>
                  )}
                </p>
              </div>

              {state.error && (
                <span className="text-[9px] max-w-[120px] truncate" style={{ color: '#f87171' }} title={state.error}>
                  {state.error}
                </span>
              )}

              {isBusy ? (
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--gia-muted)' }} />
              ) : state.status === 'connected' ? (
                <button
                  type="button"
                  onClick={() => handleDisconnect(server.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#34d399' }}
                  title="Disconnect"
                >
                  <PowerOff size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnect(server.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--gia-muted)' }}
                  title="Connect"
                >
                  <Power size={12} />
                </button>
              )}

              {state.status !== 'connected' && (
                <button
                  type="button"
                  onClick={() => removeServer(server.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--gia-muted)' }}
                >
                  <X size={11} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {servers.filter(s => connState(s.id).status === 'connected').length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#34d399' }}>
          <Wifi size={11} />
          <span>
            {servers.filter(s => connState(s.id).status === 'connected').length} server(s) connected ·{' '}
            {servers.reduce((sum, s) => sum + connState(s.id).toolCount, 0)} tools available
          </span>
        </div>
      )}
    </div>
  );
};

export default MCPSettings;
