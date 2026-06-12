import React, { useState, useEffect } from 'react';
import { Radio, RadioTower, Power, PowerOff, Activity, RefreshCw, Route } from 'lucide-react';
import gatewayManager from '../../services/gateway/GatewayManager';

export const GatewaySection: React.FC = () => {
  const [routes, setRoutes] = useState(gatewayManager.getRoutes());
  const [logs, setLogs] = useState(gatewayManager.getLogs(10));
  const [stats, setStats] = useState(gatewayManager.getStats());

  const refresh = () => {
    setRoutes(gatewayManager.getRoutes());
    setLogs(gatewayManager.getLogs(10));
    setStats(gatewayManager.getStats());
  };

  useEffect(() => { const iv = setInterval(refresh, 5000); return () => clearInterval(iv); }, []);

  const handleToggle = (id: string, current: boolean) => {
    if (current) {
      gatewayManager.stopRoute(id);
    } else {
      gatewayManager.startRoute(id);
    }
    refresh();
  };

  const handleRemove = (id: string) => {
    gatewayManager.removeRoute(id);
    refresh();
  };

  const handleRefresh = () => {
    gatewayManager.refreshAll();
    refresh();
  };

  return (
    <div className="space-y-3">
      {/* Gateway Status Card */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RadioTower size={16} style={{ color: '#8b5cf6' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Gateway</span>
          </div>
          <button onClick={handleRefresh}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.activeRoutes}</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Active Routes</div>
          </div>
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.messagesProcessed}</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Messages</div>
          </div>
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.errors}</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Errors</div>
          </div>
        </div>

        <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
          Gateway routes messages between platforms and GIA. Currently runs in-app — for 24/7 operation, start the gateway daemon in your proot terminal.
        </p>
      </div>

      {/* Routes */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Route size={16} style={{ color: '#f59e0b' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Routes</span>
        </div>

        {routes.length === 0 ? (
          <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
            No routes configured. Routes link a platform channel to GIA's conversation pipeline.
          </p>
        ) : (
          <div className="space-y-2">
            {routes.map((r) => (
              <div key={r.id}
                className="p-3 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}
              >
                <div className="flex items-center gap-3">
                  <Activity size={14} style={{ color: r.active ? '#34d399' : '#6b7280' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{r.name}</span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                      {r.source} → {r.target}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggle(r.id, r.active)}
                      className={`p-1.5 rounded-lg transition-all tap-feedback ${
                        r.active ? 'text-emerald-400' : 'text-red-400'
                      }`}
                      style={{ background: r.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}
                    >
                      {r.active ? <Power size={12} /> : <PowerOff size={12} />}
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    r.active ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-500/10'
                  }`}>
                    {r.active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => handleRemove(r.id)}
                    className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Radio size={14} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Recent Activity</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px]">
                <span className="shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 ${
                  log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-400'
                }`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className="truncate" style={{ color: 'var(--gia-text)' }}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
