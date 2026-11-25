import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Link2, Loader2, RefreshCw, Search, Unlink } from 'lucide-react';
import composioService, { type ComposioAccount, type ComposioToolkit } from '../../services/connectors/ComposioService';
import { useGiaStore } from '../../store/useGiaStore';

function humanDate(ts?: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusChip(status: string) {
  const s = status.toUpperCase();
  const cls =
    s === 'ACTIVE' ? 'text-emerald-400 bg-emerald-500/10' :
    s === 'FAILED' ? 'text-red-400 bg-red-500/10' :
    s === 'INITIATED' ? 'text-amber-400 bg-amber-500/10' :
    'text-zinc-400 bg-zinc-500/10';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

type ConnectPhase = 'connecting' | 'connected' | 'failed';

export const ComposioSection: React.FC = () => {
  const [hasKey, setHasKey] = useState(() => composioService.hasKey());
  const [keyInput, setKeyInput] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [loadingToolkits, setLoadingToolkits] = useState(false);
  const [toolkitError, setToolkitError] = useState<string | undefined>(undefined);
  const [connections, setConnections] = useState<ComposioAccount[]>([]);
  const [connectPhases, setConnectPhases] = useState<Record<string, { phase: ConnectPhase; message?: string }>>({});
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await composioService.listAccounts());
    } catch {
      /* keep the previous list on transient errors */
    }
  }, []);

  // Debounce the catalog search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Catalog fetch (only while keyed), re-run on debounced query change.
  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    setLoadingToolkits(true);
    setToolkitError(undefined);
    composioService.getToolkits(debouncedQuery)
      .then(t => { if (!cancelled) setToolkits(t); })
      .catch(e => { if (!cancelled) setToolkitError(e instanceof Error ? e.message : 'Failed to load toolkits'); })
      .finally(() => { if (!cancelled) setLoadingToolkits(false); });
    return () => { cancelled = true; };
  }, [hasKey, debouncedQuery]);

  // Connections list + live updates from the service (initiate/disconnect/status change).
  useEffect(() => {
    if (!hasKey) return;
    refreshConnections();
    const unsub = composioService.onAccountsChanged(() => { refreshConnections(); });
    return unsub;
  }, [hasKey, refreshConnections]);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    composioService.setKey(trimmed);
    setKeyInput('');
    setHasKey(true);
    useGiaStore.getState().addNotification('Composio connected');
  };

  const handleRemoveKey = () => {
    composioService.clearKey();
    setHasKey(false);
    setToolkits([]);
    setConnections([]);
    setConnectPhases({});
    useGiaStore.getState().addNotification('Composio key removed');
  };

  const handleConnect = async (toolkit: ComposioToolkit) => {
    setConnectPhases(p => ({ ...p, [toolkit.slug]: { phase: 'connecting' } }));
    try {
      // Composio hosts the OAuth redirect server-side; openAndTrack opens the
      // in-app browser and polls until the account is ACTIVE.
      await composioService.openAndTrack(toolkit.slug);
      setConnectPhases(p => ({ ...p, [toolkit.slug]: { phase: 'connected' } }));
      useGiaStore.getState().addNotification(`${toolkit.name} connected via Composio`);
      await refreshConnections();
    } catch (e) {
      setConnectPhases(p => ({
        ...p,
        [toolkit.slug]: { phase: 'failed', message: e instanceof Error ? e.message : 'Connection failed' },
      }));
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await composioService.disconnect(id);
      await refreshConnections();
    } catch (e) {
      useGiaStore.getState().addNotification(`Disconnect failed: ${e instanceof Error ? e.message : 'error'}`);
    }
  };

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={16} style={{ color: '#a78bfa' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Composio</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-auto ${hasKey ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-500/10'}`}>
          {hasKey ? 'connected' : 'not connected'}
        </span>
      </div>

      {!hasKey ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
            One key unlocks hundreds of connectors. Composio handles OAuth for you — no per-service API keys.
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
            Paste your Composio API key once, then connect Gmail, GitHub, Notion, Slack and hundreds more with a tap. Composio hosts every OAuth flow server-side — GIA never stores your per-service passwords.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Paste your Composio API key…"
            className="text-xs px-2.5 py-2 rounded-lg outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSaveKey}
              disabled={!keyInput.trim()}
              className="text-[10px] px-2.5 py-1.5 rounded-lg tap-feedback disabled:opacity-40"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
              Save
            </button>
            <a href="https://app.composio.dev/settings" target="_blank" rel="noreferrer"
              className="text-[10px] underline" style={{ color: '#60a5fa' }}>
              Get your key at app.composio.dev/settings
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Catalog search */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)' }}>
            <Search size={12} style={{ color: 'var(--gia-muted-2)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search connectors (gmail, github, notion…)"
              className="flex-1 text-[11px] bg-transparent outline-none min-w-0"
              style={{ color: 'var(--gia-text)' }}
            />
            <button onClick={() => setDebouncedQuery(query.trim())} title="Refresh catalog" className="tap-feedback p-0.5">
              <RefreshCw size={12} style={{ color: 'var(--gia-muted-2)' }} />
            </button>
          </div>

          {toolkitError && (
            <p className="text-[10px] text-red-400 break-words">{toolkitError}</p>
          )}

          {/* Toolkit grid — 2 columns on phones, 3 from sm up */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {loadingToolkits && toolkits.length === 0 && (
              <div className="col-span-2 sm:col-span-3 flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--gia-muted-2)' }} />
              </div>
            )}
            {!loadingToolkits && toolkits.length === 0 && !toolkitError && (
              <p className="col-span-2 sm:col-span-3 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                {debouncedQuery ? 'No connectors match your search.' : 'Catalog is loading…'}
              </p>
            )}
            {toolkits.map(t => {
              const phase = connectPhases[t.slug];
              return (
                <div key={t.slug} className="p-2 rounded-xl flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {t.logo && !failedLogos[t.slug] ? (
                      <img src={t.logo} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0"
                        onError={() => setFailedLogos(p => ({ ...p, [t.slug]: true }))} />
                    ) : (
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        {t.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{t.name}</p>
                      <p className="text-[9px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{t.slug}</p>
                    </div>
                  </div>
                  {phase?.phase === 'connecting' ? (
                    <div className="flex items-center gap-1 text-[9px]" style={{ color: '#f59e0b' }}>
                      <Loader2 size={10} className="animate-spin" /> Waiting for OAuth…
                    </div>
                  ) : phase?.phase === 'connected' ? (
                    <div className="flex items-center gap-1 text-[9px] text-emerald-400">
                      <CheckCircle2 size={10} /> Connected
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleConnect(t)}
                        className="text-[9px] px-2 py-1 rounded-lg tap-feedback flex items-center justify-center gap-1"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        <Link2 size={10} /> Connect
                      </button>
                      {phase?.phase === 'failed' && (
                        <p className="text-[9px] text-red-400 leading-snug break-words">{phase.message || 'Connection failed'}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Connected accounts */}
          {connections.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Connected accounts</span>
              {connections.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{a.toolkitSlug || a.id}</span>
                      {statusChip(a.status)}
                      {a.status === 'ACTIVE' && a.createdAt && (
                        <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                          connected {humanDate(a.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{a.id}</p>
                  </div>
                  <button onClick={() => handleDisconnect(a.id)} title="Disconnect"
                    className="p-1.5 rounded-lg tap-feedback" style={{ color: '#f87171' }}>
                    <Unlink size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
            <a href="https://app.composio.dev/settings" target="_blank" rel="noreferrer"
              className="text-[10px] underline" style={{ color: '#60a5fa' }}>
              Manage at app.composio.dev
            </a>
            <button onClick={handleRemoveKey}
              className="text-[9px] px-2 py-1 rounded-lg text-red-400 bg-red-500/10 tap-feedback">
              Remove key
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
