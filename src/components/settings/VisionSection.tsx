import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Download, AlertTriangle, CheckCircle, Clock, RefreshCw, Sliders, ToggleLeft, BarChart3 } from 'lucide-react';
import { Switch } from '../ui/Switch';
import VisionRouter from '../../services/vision/VisionRouter';
import type { ModelStatusEntry, VisionRouterStats } from '../../services/vision/VisionRouter';

// ── Types ───────────────────────────────────────────────────────────

type ModelStatusKey = 'not_loaded' | 'loading' | 'ready' | 'error';

const STATUS_CONFIG: Record<ModelStatusKey, { label: string; color: string; bg: string }> = {
  not_loaded: { label: 'Not Loaded', color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
  loading:    { label: 'Loading',    color: '#fbbf24',  bg: 'rgba(251,191,36,0.1)' },
  ready:      { label: 'Ready',      color: '#34d399',  bg: 'rgba(52,211,153,0.1)' },
  error:      { label: 'Error',      color: '#f87171',  bg: 'rgba(248,113,113,0.1)' },
};

// ── Component ──────────────────────────────────────────────────────

export const VisionSection: React.FC = () => {
  const router = VisionRouter;

  // ── State ──────────────────────────────────────────────────────
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatusEntry>>({});
  const [stats, setStats] = useState<VisionRouterStats>(router.stats);
  const [threshold, setThreshold] = useState(() => router.confidenceThreshold);
  const [fallbackOn, setFallbackOn] = useState(() => router.fallbackEnabled);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Refresh data from router ──────────────────────────────────
  const refresh = useCallback(() => {
    setModelStatuses(router.getStatus());
    setStats({ ...router.stats });
    setThreshold(router.confidenceThreshold);
    setFallbackOn(router.fallbackEnabled);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // ── Handlers ──────────────────────────────────────────────────
  const [selectedModels, setSelectedModels] = useState<Record<string, boolean>>({});
  const [downloadingModels, setDownloadingModels] = useState<Record<string, boolean>>({});

  const handleDownloadModel = useCallback(async (modelId: string) => {
    if (downloadingModels[modelId]) return;
    setDownloadingModels(prev => ({ ...prev, [modelId]: true }));
    try {
      await router.downloadModel(modelId);
    } catch {
      // error already logged by router
    } finally {
      setDownloadingModels(prev => ({ ...prev, [modelId]: false }));
      refresh();
    }
  }, [router, refresh, downloadingModels]);

  const handleDownloadSelected = useCallback(async () => {
    const toDownload = Object.entries(selectedModels)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (toDownload.length === 0) return;
    setDownloadingModels(prev => {
      const next = { ...prev };
      for (const id of toDownload) next[id] = true;
      return next;
    });
    try {
      for (const modelId of toDownload) {
        await router.downloadModel(modelId);
      }
    } catch {
      // error already logged by router
    } finally {
      setDownloadingModels(prev => {
        const next = { ...prev };
        for (const id of toDownload) delete next[id];
        return next;
      });
      refresh();
    }
  }, [router, refresh, selectedModels]);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    try {
      await router.downloadAllModels();
    } catch {
      // error already logged by router
    } finally {
      setDownloading(false);
      refresh();
    }
  }, [router, refresh]);

  const handleThresholdChange = useCallback((val: number) => {
    router.confidenceThreshold = val;
    setThreshold(val);
    localStorage.setItem('gia-vision-threshold', String(val));
  }, [router]);

  const handleFallbackToggle = useCallback((on: boolean) => {
    router.fallbackEnabled = on;
    setFallbackOn(on);
    localStorage.setItem('gia-vision-fallback', String(on));
  }, [router]);

  // ── Persist threshold on mount ────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('gia-vision-threshold');
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1.0) {
        router.confidenceThreshold = parsed;
        setThreshold(parsed);
      }
    }
    const savedFallback = localStorage.getItem('gia-vision-fallback');
    if (savedFallback !== null) {
      const fb = savedFallback === 'true';
      router.fallbackEnabled = fb;
      setFallbackOn(fb);
    }
  }, [router]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Eye size={14} style={{ color: '#a855f7' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Vision Models
        </span>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="ml-auto p-1 rounded hover:bg-zinc-800 transition-colors"
          title="Refresh status"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      {/* Clear explanation that these models run on-device (downloaded locally) */}
      <div className="px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
        <p className="font-medium mb-1">📱 On-Device Vision Models</p>
        <p>These models run <strong>locally on your device</strong> (no data sent externally). When you enable a model, it will be downloaded to your device storage the first time it's used. Models marked "Ready" are already cached and available.</p>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        On-device ONNX vision models for captioning, OCR, object detection, and classification.
        Fallback to provider vision (GPT-4o, Gemini, Claude) when confidence is low.
      </p>

      {/* ── Model Status Table ────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="text-left py-1.5 pr-1 font-medium" style={{ color: 'var(--gia-muted)', width: '14px' }}>
                <input
                  type="checkbox"
                  checked={Object.values(selectedModels).filter(Boolean).length === Object.keys(modelStatuses).length && Object.keys(modelStatuses).length > 0}
                  onChange={(e) => {
                    const all = e.target.checked;
                    const next: Record<string, boolean> = {};
                    for (const key of Object.keys(modelStatuses)) next[key] = all;
                    setSelectedModels(next);
                  }}
                  style={{ accentColor: '#a855f7' }}
                />
              </th>
              <th className="text-left py-1.5 pr-2 font-medium" style={{ color: 'var(--gia-muted)' }}>Model</th>
              <th className="text-left py-1.5 px-2 font-medium" style={{ color: 'var(--gia-muted)' }}>Status</th>
              <th className="text-right py-1.5 pl-2 font-medium" style={{ color: 'var(--gia-muted)' }}>Size</th>
              <th className="text-right py-1.5 pl-2 font-medium" style={{ color: 'var(--gia-muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(modelStatuses).map(([modelId, entry]) => {
              const cfg = STATUS_CONFIG[entry.status as ModelStatusKey] || STATUS_CONFIG.not_loaded;
              const shortName = modelId.replace('Xenova/', '').replace(/-/g, ' ');
              const isDownloading = downloadingModels[modelId];
              return (
                <tr key={modelId} className="border-t" style={{ borderColor: 'var(--gia-border)' }}>
                  <td className="py-1.5 pr-1">
                    <input
                      type="checkbox"
                      checked={!!selectedModels[modelId]}
                      onChange={(e) => setSelectedModels(prev => ({ ...prev, [modelId]: e.target.checked }))}
                      style={{ accentColor: '#a855f7' }}
                    />
                  </td>
                  <td className="py-1.5 pr-2" style={{ color: 'var(--gia-text)' }}>
                    <span className="capitalize">{shortName}</span>
                  </td>
                  <td className="py-1.5 px-2">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {entry.status === 'ready' && <CheckCircle size={8} />}
                      {entry.status === 'error' && <AlertTriangle size={8} />}
                      {entry.status === 'loading' && <RefreshCw size={8} className="animate-spin" />}
                      {cfg.label}
                    </span>
                    {entry.error && (
                      <span className="block text-[8px] mt-0.5" style={{ color: '#f87171' }}>
                        {entry.error}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2 text-right" style={{ color: 'var(--gia-muted-2)' }}>
                    {entry.downloadSizeEstimate}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    {entry.status !== 'ready' && (
                      <button
                        onClick={() => handleDownloadModel(modelId)}
                        disabled={isDownloading}
                        className="px-2 py-1 rounded text-[9px] font-medium transition-all"
                        style={{
                          background: isDownloading ? 'var(--gia-bg-2)' : 'rgba(168,85,247,0.1)',
                          color: isDownloading ? 'var(--gia-muted)' : '#a855f7',
                          border: `1px solid ${isDownloading ? 'var(--gia-border)' : 'rgba(168,85,247,0.2)'}`,
                        }}
                      >
                        {isDownloading ? '...' : 'Download'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Download Buttons ────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownloadSelected}
          disabled={Object.values(selectedModels).filter(Boolean).length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[11px] font-medium transition-all flex-1"
          style={{
            background: Object.values(selectedModels).filter(Boolean).length === 0 ? 'var(--gia-bg-2)' : 'rgba(168,85,247,0.1)',
            color: Object.values(selectedModels).filter(Boolean).length === 0 ? 'var(--gia-muted)' : '#a855f7',
            border: `1px solid ${Object.values(selectedModels).filter(Boolean).length === 0 ? 'var(--gia-border)' : 'rgba(168,85,247,0.2)'}`,
          }}
        >
          <Download size={13} />
          Download Selected ({Object.values(selectedModels).filter(Boolean).length})
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={downloading}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-medium transition-all"
          style={{
            background: 'var(--gia-bg-2)',
            color: 'var(--gia-muted-2)',
            border: '1px solid var(--gia-border)',
          }}
        >
          {downloading ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
          All
        </button>
      </div>

      {/* ── Confidence Threshold ───────────────────────────────── */}
      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'var(--gia-muted)' }}>
          <Sliders size={11} />
          Confidence Threshold: {threshold.toFixed(1)}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>0.1</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={threshold}
            onChange={e => handleThresholdChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#a855f7' }}
          />
          <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>1.0</span>
        </div>
        <div className="flex justify-between text-[8px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          <span>More fallbacks</span>
          <span>More local results</span>
        </div>
        <p className="text-[9px] mt-1.5" style={{ color: 'var(--gia-muted-2)' }}>
          When local model confidence is below this threshold, the provider fallback is used.
        </p>
      </div>

      {/* ── Fallback Toggle ────────────────────────────────────── */}
      <Switch
        checked={fallbackOn}
        onChange={handleFallbackToggle}
        icon={<ToggleLeft size={11} />}
        label="Provider Fallback"
        description="When enabled, falls back to GPT-4o/Gemini/Claude vision if local confidence is low or model fails."
        accentColor="#a855f7"
      />

      {/* ── Stats Display ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 size={11} style={{ color: 'var(--gia-muted)' }} />
          <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--gia-muted)' }}>
            Usage Statistics
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Local calls */}
          <div className="p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
            <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>Local Calls</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#34d399' }}>
              {stats.localCalls}
              {stats.localErrors > 0 && (
                <span className="ml-1.5 text-[10px]" style={{ color: '#f87171' }}>
                  ({stats.localErrors} err)
                </span>
              )}
            </p>
          </div>
          {/* Provider calls */}
          <div className="p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
            <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>Provider Calls</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#a855f7' }}>
              {stats.providerCalls}
              {stats.providerErrors > 0 && (
                <span className="ml-1.5 text-[10px]" style={{ color: '#f87171' }}>
                  ({stats.providerErrors} err)
                </span>
              )}
            </p>
          </div>
          {/* Avg local latency */}
          <div className="p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
            <div className="flex items-center gap-1">
              <Clock size={8} style={{ color: 'var(--gia-muted-2)' }} />
              <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>Avg Local</p>
            </div>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--gia-text)' }}>
              {stats.avgLocalLatency > 0 ? `${stats.avgLocalLatency} ms` : '—'}
            </p>
          </div>
          {/* Avg provider latency */}
          <div className="p-2 rounded" style={{ background: 'var(--gia-bg-2)' }}>
            <div className="flex items-center gap-1">
              <Clock size={8} style={{ color: 'var(--gia-muted-2)' }} />
              <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>Avg Provider</p>
            </div>
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--gia-text)' }}>
              {stats.avgProviderLatency > 0 ? `${stats.avgProviderLatency} ms` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Reset stats */}
      <button
        onClick={() => {
          router.stats.localCalls = 0;
          router.stats.providerCalls = 0;
          router.stats.localErrors = 0;
          router.stats.providerErrors = 0;
          router.stats.avgLocalLatency = 0;
          router.stats.avgProviderLatency = 0;
          (router as unknown as { _localLatencyTotal: number; _providerLatencyTotal: number })._localLatencyTotal = 0;
          (router as unknown as { _localLatencyTotal: number; _providerLatencyTotal: number })._providerLatencyTotal = 0;
          refresh();
        }}
        className="text-[9px] font-medium px-2 py-1 rounded self-start"
        style={{ color: 'var(--gia-muted-2)', border: '1px solid var(--gia-border)' }}
      >
        Reset Statistics
      </button>
    </div>
  );
};
