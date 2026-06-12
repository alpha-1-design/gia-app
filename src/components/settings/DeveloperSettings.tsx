import React, { useState, useEffect, useCallback } from 'react';
import { Terminal, Bug, Wifi, Trash2, RefreshCw, Database, Eye, ShieldAlert, ScrollText, Cpu, Binary, HardDrive } from 'lucide-react';
import { Switch } from '../ui/Switch';
import { useGiaStore } from '../../store/useGiaStore';
import { logger } from '../../utils/logger';

export const DeveloperSettings: React.FC = () => {
  const addNotification = useGiaStore(s => s.addNotification);

  // ── Toggles from global store ──────────────────────────────────
  const [smartFallback, setSmartFallback] = useState(() => {
    const v = useGiaStore.getState().smartFallback;
    return v !== undefined ? v : true;
  });
  const [outputValidation, setOutputValidation] = useState(() => {
    const v = useGiaStore.getState().outputValidation;
    return v !== undefined ? v : true;
  });
  const [responseCache, setResponseCache] = useState(() => {
    const v = useGiaStore.getState().responseCache;
    return v !== undefined ? v : true;
  });
  const [showTokenUsage, setShowTokenUsage] = useState(() =>
    localStorage.getItem('gia-show-token-usage') === 'true'
  );

  // ── Log level ──────────────────────────────────────────────────
  const [logLevel, setLogLevel] = useState(() =>
    localStorage.getItem('gia-log-level') || 'warn'
  );

  // ── Network debugging ──────────────────────────────────────────
  const [networkLogs, setNetworkLogs] = useState<{ time: string; url: string; status: number; ms: number }[]>([]);
  const [capturingNetwork, setCapturingNetwork] = useState(false);

  // ── Cache stats ────────────────────────────────────────────────
  const [cacheSize, setCacheSize] = useState('?');

  const refreshCacheInfo = useCallback(async () => {
    try {
      if ('caches' in globalThis) {
        const keys = await caches.keys();
        let total = 0;
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          total += requests.length;
        }
        setCacheSize(`${keys.length} caches, ${total} entries`);
      } else {
        setCacheSize('Cache API unavailable');
      }
    } catch {
      setCacheSize('Error reading cache');
    }
  }, []);

  useEffect(() => { refreshCacheInfo(); }, [refreshCacheInfo]);

  // ── Network capture patcher ────────────────────────────────────
  const toggleNetworkCapture = useCallback(async (on: boolean) => {
    setCapturingNetwork(on);
    if (on) {
      setNetworkLogs([]);
      addNotification('Network capture active — check console for output');
    }
  }, [addNotification]);

  // ── Clear all caches + local model data ────────────────────────
  const handleClearAllCaches = useCallback(async () => {
    try {
      if ('caches' in globalThis) {
        const keys = await caches.keys();
        for (const key of keys) {
          // Don't remove critical app caches if any
          if (!key.startsWith('gia-')) continue;
          await caches.delete(key);
        }
      }
      // Clear localStorage keys used by GIA
      const giaKeys = Object.keys(localStorage).filter(k => k.startsWith('gia-'));
      for (const k of giaKeys) {
        if (k === 'gia-wake-word' || k === 'gia-auto-start-wake-word' || k === 'gia-voice-language') continue;
        localStorage.removeItem(k);
      }
      addNotification('Cleared app caches and local storage');
      refreshCacheInfo();
    } catch (e) {
      addNotification(`Cache clear failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  }, [addNotification, refreshCacheInfo]);

  // ── Persist toggles ────────────────────────────────────────────
  useEffect(() => {
    useGiaStore.getState().setSmartFallback?.(smartFallback);
  }, [smartFallback]);
  useEffect(() => {
    useGiaStore.getState().setOutputValidation?.(outputValidation);
  }, [outputValidation]);
  useEffect(() => {
    useGiaStore.getState().setResponseCache?.(responseCache);
  }, [responseCache]);
  useEffect(() => {
    localStorage.setItem('gia-show-token-usage', String(showTokenUsage));
  }, [showTokenUsage]);
  useEffect(() => {
    localStorage.setItem('gia-log-level', logLevel);
  }, [logLevel]);

  // ── Persist log level to actual console filter ─────────────────
  useEffect(() => {
    (logger as unknown as { setLevel?: (l: string) => void }).setLevel?.(logLevel);
  }, [logLevel]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Terminal size={14} style={{ color: '#f59e0b' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Advanced Developer Settings
        </span>
      </div>

      <div className="px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', color: '#fde68a' }}>
        <p className="font-medium mb-1">⚙️ Developer Controls</p>
        <p>Fine-tune GIA internals — caching, validation, fallback behaviour, and debugging tools. Changes take effect immediately.</p>
      </div>

      {/* ── Behaviour Toggles ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p className="text-[10px] uppercase tracking-wider font-medium flex items-center gap-1.5" style={{ color: 'var(--gia-muted)' }}>
          <Cpu size={11} /> Behaviour
        </p>

        <Switch
          checked={smartFallback}
          onChange={setSmartFallback}
          icon={<ShieldAlert size={11} />}
          label="Smart Fallback"
          description="When a provider fails, GIA automatically tries the next best available provider based on success history."
          accentColor="#f59e0b"
        />

        <Switch
          checked={outputValidation}
          onChange={setOutputValidation}
          icon={<Eye size={11} />}
          label="Output Validation"
          description="Sanitises provider responses for broken markdown, unbalanced HTML, and encoding issues."
          accentColor="#f59e0b"
        />

        <Switch
          checked={responseCache}
          onChange={setResponseCache}
          icon={<Database size={11} />}
          label="Response Cache"
          description="Caches identical prompts so repeated queries return instantly without a provider call."
          accentColor="#f59e0b"
        />

        <Switch
          checked={showTokenUsage}
          onChange={setShowTokenUsage}
          icon={<Binary size={11} />}
          label="Show Token Usage"
          description="Display token counts after each response in the chat."
          accentColor="#f59e0b"
        />
      </div>

      {/* ── Log Level ──────────────────────────────────────────── */}
      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--gia-muted)' }}>
          <ScrollText size={11} />
          Console Log Level
        </label>
        <div className="flex gap-1">
          {[
            { value: 'debug', label: 'Debug', color: '#6b7280' },
            { value: 'log', label: 'Log', color: '#3b82f6' },
            { value: 'warn', label: 'Warn', color: '#f59e0b' },
            { value: 'error', label: 'Error', color: '#ef4444' },
          ].map(l => (
            <button
              key={l.value}
              onClick={() => setLogLevel(l.value)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all"
              style={{
                background: logLevel === l.value ? `${l.color}20` : 'rgba(255,255,255,0.04)',
                color: logLevel === l.value ? l.color : 'var(--gia-muted)',
                border: `1px solid ${logLevel === l.value ? `${l.color}30` : 'transparent'}`,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Network Capture ────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gia-muted)' }}>
            <Wifi size={11} />
            Network Monitor
          </label>
          <button
            onClick={() => toggleNetworkCapture(!capturingNetwork)}
            className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
              capturingNetwork ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {capturingNetwork ? 'Capturing...' : 'Start Capture'}
          </button>
        </div>
        {networkLogs.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-lg p-2 text-[9px] font-mono" style={{ background: 'var(--gia-bg-2)' }}>
            {networkLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span style={{ color: log.status < 400 ? '#34d399' : '#f87171' }}>
                  {log.status}
                </span>
                <span className="truncate" style={{ color: 'var(--gia-muted-2)' }}>
                  {log.url.slice(0, 60)}
                </span>
                <span className="shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
                  {log.ms}ms
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          Monitor network requests made by GIA. Check the browser DevTools Network tab for full details.
        </p>
      </div>

      {/* ── Cache Info ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--gia-muted)' }}>
            <HardDrive size={11} />
            Browser Cache
          </span>
          <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            {cacheSize}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearAllCaches}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <Trash2 size={10} /> Clear Caches
          </button>
          <button
            onClick={refreshCacheInfo}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}
          >
            <RefreshCw size={10} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Debug Info ─────────────────────────────────────────── */}
      <details>
        <summary className="flex items-center gap-1.5 text-[10px] font-medium cursor-pointer" style={{ color: 'var(--gia-muted)' }}>
          <Bug size={11} />
          Debug Info
        </summary>
        <pre
          className="mt-2 p-2 rounded-lg text-[9px] leading-relaxed overflow-x-auto"
          style={{ background: 'var(--gia-bg-2)', color: 'var(--gia-muted-2)' }}
        >
{`User Agent:  ${navigator.userAgent}
Platform:    ${navigator.platform}
Language:    ${navigator.language}
Online:      ${navigator.onLine}
Screen:      ${screen.width}x${screen.height}
Local Keys:  ${Object.keys(localStorage).filter(k => k.startsWith('gia-')).length}
Caches:      ${cacheSize}`}
        </pre>
      </details>
    </div>
  );
};
