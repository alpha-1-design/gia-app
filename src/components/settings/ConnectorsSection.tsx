import React, { useState, useEffect } from 'react';
import { Plug, PlugZap, Key, RefreshCw, Power, PowerOff } from 'lucide-react';
import connectorManager from '../../services/connectors/ConnectorManager';

export const ConnectorsSection: React.FC = () => {
  const [connectors, setConnectors] = useState(connectorManager.getAll());
  const [editId, setEditId] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const refresh = () => setConnectors(connectorManager.getAll());

  useEffect(() => { const iv = setInterval(refresh, 5000); return () => clearInterval(iv); }, []);

  const handleConfigure = (id: string) => {
    if (apiKeyInput.trim()) {
      connectorManager.configure(id, { apiKey: apiKeyInput.trim(), enabled: true });
      setEditId(null);
      setApiKeyInput('');
      refresh();
    }
  };

  const handleToggle = (id: string, current: boolean) => {
    connectorManager.configure(id, { enabled: !current });
    refresh();
  };

  const handleTest = async (id: string) => {
    await connectorManager.testConnection(id);
    refresh();
  };

  const handleRemove = (id: string) => {
    connectorManager.configure(id, { apiKey: undefined, enabled: false, status: 'disconnected' });
    refresh();
  };

  const typeIcons: Record<string, React.ReactNode> = {
    api: <Plug size={14} />,
    messaging: <PlugZap size={14} />,
    database: <Key size={14} />,
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <PlugZap size={16} style={{ color: '#f59e0b' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Connectors</span>
      </div>
      <div className="space-y-2">
        {connectors.map((c) => (
          <div key={c.id}
            className="p-3 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>
                    {typeIcons[c.type] || <Plug size={14} />}
                    <span className="ml-1.5">{c.name}</span>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    c.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10' :
                    c.status === 'error' ? 'text-red-400 bg-red-500/10' :
                    'text-zinc-500 bg-zinc-500/10'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{c.description}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={() => handleTest(c.id)}
                  className="p-1.5 rounded-lg transition-all tap-feedback"
                  style={{ color: 'var(--gia-muted-2)' }}
                  title="Test connection">
                  <RefreshCw size={12} />
                </button>
                <button onClick={() => handleToggle(c.id, c.enabled)}
                  className="p-1.5 rounded-lg transition-all tap-feedback"
                  style={{ color: c.enabled ? '#34d399' : '#f87171' }}>
                  {c.enabled ? <Power size={12} /> : <PowerOff size={12} />}
                </button>
              </div>
            </div>

            {editId === c.id ? (
              <div className="flex gap-2 mt-2">
                <input
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="Paste API key..."
                  className="flex-1 text-[10px] px-2.5 py-1.5 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
                  autoFocus
                />
                <button onClick={() => handleConfigure(c.id)}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                  Save
                </button>
                <button onClick={() => { setEditId(null); setApiKeyInput(''); }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg"
                  style={{ color: 'var(--gia-muted)' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => { setEditId(c.id); setApiKeyInput(c.apiKey || ''); }}
                  className={`text-[9px] px-2 py-1 rounded-lg transition-all ${
                    c.apiKey ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 bg-zinc-500/10'
                  }`}>
                  {c.apiKey ? 'Change Key' : 'Set API Key'}
                </button>
                {c.apiKey && (
                  <button onClick={() => handleRemove(c.id)}
                    className="text-[9px] px-2 py-1 rounded-lg text-red-400 bg-red-500/10">
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
