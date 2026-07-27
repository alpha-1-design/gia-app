import React, { useState, useEffect } from 'react';
import { Plug, PlugZap, Key, RefreshCw, Power, PowerOff, Cloud, Mail } from 'lucide-react';
import connectorManager from '../../services/connectors/ConnectorManager';
import { useGiaStore } from '../../store/useGiaStore';

export const ConnectorsSection: React.FC = () => {
  const [connectors, setConnectors] = useState(() => connectorManager.getAll().filter(c => c.id !== 'telegram' && c.id !== 'whatsapp'));
  const [editId, setEditId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const refresh = () => setConnectors(connectorManager.getAll().filter(c => c.id !== 'telegram' && c.id !== 'whatsapp'));

  useEffect(() => { refresh(); }, []);

  const handleConfigure = (c: { id: string; fields?: { key: string; required: boolean }[] }) => {
    const filled = c.fields?.every(f => !f.required || fieldValues[f.key]?.trim());
    if (!filled) return;
    const config: Record<string, string> = {};
    for (const f of c.fields || []) {
      if (fieldValues[f.key]?.trim()) config[f.key] = fieldValues[f.key].trim();
    }
    connectorManager.configure(c.id, { config, enabled: true });
    setEditId(null);
    setFieldValues({});
    refresh();
    useGiaStore.getState().addNotification(`Connector saved: ${c.id}`);
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
    connectorManager.configure(id, { config: {}, apiKey: undefined, enabled: false, status: 'disconnected' });
    refresh();
  };

  const openEdit = (c: { id: string; fields?: { key: string }[]; config?: Record<string, string>; apiKey?: string }) => {
    const vals: Record<string, string> = {};
    for (const f of c.fields || []) {
      vals[f.key] = c.config?.[f.key] || (f.key === 'apiKey' ? (c.apiKey || '') : '');
    }
    setFieldValues(vals);
    setEditId(c.id);
  };

  const typeIcons: Record<string, React.ReactNode> = {
    api: <Plug size={14} />,
    messaging: <Mail size={14} />,
    database: <Key size={14} />,
    cloud: <Cloud size={14} />,
    storage: <Cloud size={14} />,
  };

  const hasAnyConfig = (c: { fields?: { key: string }[]; config?: Record<string, string>; apiKey?: string }) =>
    c.fields?.some(f => c.config?.[f.key] || (f.key === 'apiKey' && c.apiKey));

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
              <div className="flex flex-col gap-2 mt-2">
                {(c.fields || []).map(f => (
                  <input key={f.key}
                    value={fieldValues[f.key] || ''}
                    onChange={e => setFieldValues(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    type={f.type}
                    className="flex-1 text-[10px] px-2.5 py-1.5 rounded-lg outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
                    autoFocus={f === (c.fields || [])[0]}
                  />
                ))}
                <div className="flex gap-2">
                  <button onClick={() => handleConfigure(c)}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    Save
                  </button>
                  <button onClick={() => { setEditId(null); setFieldValues({}); }}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg"
                    style={{ color: 'var(--gia-muted)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => openEdit(c)}
                  className={`text-[9px] px-2 py-1 rounded-lg transition-all ${
                    hasAnyConfig(c) ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 bg-zinc-500/10'
                  }`}>
                  {hasAnyConfig(c) ? 'Edit Config' : 'Configure'}
                </button>
                {hasAnyConfig(c) && (
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
