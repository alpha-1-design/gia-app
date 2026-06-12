import React, { useState, useEffect } from 'react';
import { RadioTower, Power, PowerOff, Activity, RefreshCw, Route, BarChart3 } from 'lucide-react';
import gatewayManager from '../../services/gateway/GatewayManager';

export const GatewaySection: React.FC = () => {
  const [routes, setRoutes] = useState(gatewayManager.getAllRoutes());
  const [logs, setLogs] = useState(gatewayManager.getLogs(10));
  const [stats, setStats] = useState(gatewayManager.getStats());

  const refresh = () => {
    setRoutes(gatewayManager.getAllRoutes());
    setLogs(gatewayManager.getLogs(10));
    setStats(gatewayManager.getStats());
  };

  useEffect(() => { const iv = setInterval(refresh, 5000); return () => clearInterval(iv); }, []);

  const handleToggle = (id: string, current: boolean) => {
    gatewayManager.updateRoute(id, { enabled: !current });
    refresh();
  };

  const handleRemove = (id: string) => {
    gatewayManager.removeRoute(id);
    refresh();
  };

  const handleRefresh = () => {
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
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.enabledRoutes}</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Active</div>
          </div>
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.totalCalls}</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Total Calls</div>
          </div>
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-lg font-bold" style={{ color: 'var(--gia-text)' }}>{stats.successRate}%</div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Success Rate</div>
          </div>
        </div>

        <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
          Gateway routes external messages to GIA. Runs in-app now — for 24/7 operation start the gateway daemon in proot terminal.
        </p>
      </div>

      {/* Routes */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Route size={16} style={{ color: '#f59e0b' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Routes</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gia-muted)' }}>{routes.length}</span>
        </div>

        {routes.length === 0 ? (
          <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
            No routes yet. Use GIA's connector tools to set up Telegram, Discords, and other platforms.
          </p>
        ) : (
          <div className="space-y-2">
            {routes.map((r: { id: string; name: string; path: string; method: string; targetUrl: string; enabled: boolean; lastCalled?: number }) => (
              <div key={r.id}
                className="p-3 rounded-xl transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--gia-border)' }}
              >
                <div className="flex items-center gap-3">
                  <Activity size={14} style={{ color: r.enabled ? '#34d399' : '#6b7280' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{r.name}</span>
                      <span className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>{r.method} {r.path}</span>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted)' }}>
                      → {r.targetUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggle(r.id, r.enabled)}
                      className={`p-1.5 rounded-lg transition-all tap-feedback ${
                        r.enabled ? 'text-emerald-400' : 'text-red-400'
                      }`}
                      style={{ background: r.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}
                    >
                      {r.enabled ? <Power size={12} /> : <PowerOff size={12} />}
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    r.enabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-500/10'
                  }`}>
                    {r.enabled ? 'Active' : 'Inactive'}
                  </span>
                  {r.lastCalled && (
                    <span className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                      Last: {new Date(r.lastCalled).toLocaleTimeString()}
                    </span>
                  )}
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
            <BarChart3 size={14} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Recent Activity</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {logs.map((log: { id: string; timestamp: number; method: string; path: string; status: number; duration: number; error?: string }, i: number) => (
              <div key={log.id || i} className="flex items-center gap-2 text-[9px]">
                <span className="shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="shrink-0" style={{
                  color: log.status >= 400 ? '#f87171' : log.status >= 300 ? '#fbbf24' : '#34d399'
                }}>
                  {log.status > 0 ? log.status : 'ERR'}
                </span>
                <span className="truncate" style={{ color: 'var(--gia-text)' }}>
                  {log.method} {log.path}{log.error ? ` — ${log.error}` : ''}
                </span>
                <span className="shrink-0" style={{ color: 'var(--gia-muted-2)' }}>{log.duration}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
