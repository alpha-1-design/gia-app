import React, { useState, useEffect, useCallback } from 'react';
import { Download, AlertTriangle, CheckCircle, RefreshCw, Cpu, HardDrive, Zap, XCircle, ShieldAlert, Info } from 'lucide-react';
import { logger } from '../../utils/logger';
import LocalLLMService, { LOCAL_LLM_MODELS, type LocalModelId, type LocalLLMState, type DownloadProgress } from '../../services/LocalLLMService';
import { detectDeviceCapabilities, checkModelCompatibility, recommendModel, type DeviceCapabilities } from '../../services/DeviceCapabilities';

type ModelStatusKey = 'not_loaded' | 'loading' | 'ready' | 'error';

const STATUS_CONFIG: Record<ModelStatusKey, { label: string; color: string; bg: string }> = {
  not_loaded: { label: 'Not Downloaded', color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
  loading:    { label: 'Downloading',   color: '#fbbf24',  bg: 'rgba(251,191,36,0.1)' },
  ready:      { label: 'Ready',         color: '#34d399',  bg: 'rgba(52,211,153,0.1)' },
  error:      { label: 'Error',         color: '#f87171',  bg: 'rgba(248,113,113,0.1)' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export const LocalModelsSection: React.FC = () => {
  const service = LocalLLMService;

  // ── Comprehensive device capability detection ────────────────────────
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);
  const [recommendedId, setRecommendedId] = useState<LocalModelId | null>(null);

  // ── State ──────────────────────────────────────────────────────
  const [statuses, setStatuses] = useState<Record<string, LocalLLMState>>(() => service.getStatus());
  const [downloading, setDownloading] = useState<LocalModelId | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeModelId, setActiveModelId] = useState<LocalModelId | null>(() => service.getLoadedModel());

  const refresh = useCallback(() => {
    setStatuses(service.getStatus());
    setActiveModelId(service.getLoadedModel());
  }, [service]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // Detect device capabilities (RAM, storage, CPU, GPU) on mount.
  useEffect(() => {
    let cancelled = false;
    detectDeviceCapabilities().then(c => {
      if (cancelled) return;
      setCaps(c);
      const rec = recommendModel(c, LOCAL_LLM_MODELS);
      setRecommendedId((rec as LocalModelId) ?? null);
    }).catch(e => logger.warn('[LocalModelsSection] capability detection failed', e));
    return () => { cancelled = true; };
  }, []);

  // Subscribe to progress updates
  useEffect(() => {
    const unsub = service.onProgress((modelId, p) => {
      setDownloading(modelId as LocalModelId);
      setProgress(p);
    });
    return unsub;
  }, [service]);

  const handleLoadModel = useCallback(async (modelId: LocalModelId) => {
    setDownloading(modelId);
    setProgress(null);
    try {
      await service.loadModel(modelId);
      setActiveModelId(modelId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      logger.error('[LocalModelsSection] Model download failed:', msg);
    } finally {
      setDownloading(null);
      setProgress(null);
      refresh();
    }
  }, [service, refresh]);

  const handleUnload = useCallback(() => {
    service.unload();
    setActiveModelId(null);
    refresh();
  }, [service, refresh]);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="flex items-center gap-2">
        <Cpu size={14} style={{ color: '#22c55e' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Local LLM Models
        </span>
        <button onClick={() => setRefreshKey(k => k + 1)}
          className="ml-auto p-1 rounded hover:bg-zinc-800 transition-colors" title="Refresh status">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
        <p className="font-medium mb-1">On-Device LLM</p>
        <p>These models run <strong>100% locally on your device</strong> using ONNX runtime. Download a model, load it, then set <strong>local-llm</strong> as your provider in Engine Room.</p>
      </div>

      {/* Device capability summary */}
      {caps && (
        <div className="px-3 py-2 rounded-xl text-[10px] leading-relaxed" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu size={10} style={{ color: '#22c55e' }} />
            <span className="font-semibold" style={{ color: 'var(--gia-text)' }}>Your device</span>
            {!caps.measured && (
              <span className="ml-auto inline-flex items-center gap-1" style={{ color: 'var(--gia-muted-2)' }}>
                <Info size={9} /> estimated
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span>RAM free: <strong style={{ color: 'var(--gia-text)' }}>~{caps.availableRAMGB.toFixed(1)} GB</strong></span>
            <span>Storage free: <strong style={{ color: 'var(--gia-text)' }}>~{caps.availableStorageGB.toFixed(1)} GB</strong></span>
            <span>CPU cores: <strong style={{ color: 'var(--gia-text)' }}>{caps.cpuCores}</strong></span>
            <span>GPU: <strong style={{ color: 'var(--gia-text)' }}>{caps.hasGPU ? 'detected' : 'CPU only'}</strong></span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {LOCAL_LLM_MODELS.map((model) => {
          const state = statuses[model.id];
          const statusKey: ModelStatusKey = (state?.status || 'not_loaded') as ModelStatusKey;
          const cfg = STATUS_CONFIG[statusKey];
          const isActive = activeModelId === model.id;
          const isLoading = downloading === model.id;
          const dlProgress = isLoading ? progress : null;

          // Compatibility verdict (only when caps are measured).
          const compat = caps ? checkModelCompatibility(caps, model) : null;
          const isRecommended = model.id === recommendedId;
          const showWarning = compat && compat.level !== 'ok';

          return (
            <div key={model.id}
              className="rounded-xl p-3 transition-all"
              style={{
                background: isActive ? 'rgba(34,197,94,0.06)' : 'var(--gia-bg-2)',
                border: `1px solid ${
                  showWarning && compat?.level === 'insufficient' ? 'rgba(248,113,113,0.35)'
                  : isActive ? 'rgba(34,197,94,0.2)'
                  : 'var(--gia-border)'
                }`,
              }}>
              {/* Model header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{model.label}</p>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>{model.description}</p>
                </div>
                {/* Compatibility badge */}
                {compat?.level === 'insufficient' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ml-1" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                    <ShieldAlert size={8} /> Won't run
                  </span>
                ) : isRecommended ? (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ml-1" style={{ background: 'rgba(34,197,94,0.1)', color: '#34d399', border: '1px solid rgba(34,197,94,0.2)' }}>
                    ✓ Best for your device
                  </span>
                ) : compat?.level === 'tight' ? (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ml-1" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <AlertTriangle size={8} /> Tight
                  </span>
                ) : null}
                {/* Status badge */}
                <span
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ml-2"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {statusKey === 'ready' && <CheckCircle size={8} />}
                  {statusKey === 'error' && <AlertTriangle size={8} />}
                  {statusKey === 'loading' && <RefreshCw size={8} className="animate-spin" />}
                  {cfg.label}
                </span>
              </div>

              {/* Specs row */}
              <div className="flex items-center gap-3 text-[10px] mb-2" style={{ color: 'var(--gia-muted-2)' }}>
                <span className="flex items-center gap-1"><Zap size={9} /> {model.parameters} params</span>
                <span className="flex items-center gap-1"><Download size={9} /> {model.downloadSize}</span>
                <span className="flex items-center gap-1"><HardDrive size={9} /> {model.ramEstimate} RAM</span>
              </div>

              {/* Compatibility warnings */}
              {compat && showWarning && (
                <div className="mb-2 space-y-1">
                  {compat.warnings.map((w, wi) => (
                    <div key={wi} className="text-[9px] p-1.5 rounded flex items-start gap-1.5 leading-snug"
                      style={{
                        background: compat.level === 'insufficient' ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)',
                        color: compat.level === 'insufficient' ? '#f87171' : '#fbbf24',
                      }}>
                      <ShieldAlert size={10} className="shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Download progress bar */}
              {isLoading && dlProgress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[9px] mb-1" style={{ color: 'var(--gia-muted)' }}>
                    <span className="truncate">{dlProgress.file || 'Downloading...'}</span>
                    <span>{dlProgress.percent}% ({formatBytes(dlProgress.loaded)} / {formatBytes(dlProgress.total)})</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${dlProgress.percent}%`,
                        background: 'linear-gradient(90deg, #22c55e, #34d399)',
                        boxShadow: '0 0 8px rgba(34,197,94,0.3)',
                      }} />
                  </div>
                </div>
              )}
              {isLoading && !dlProgress && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                    <RefreshCw size={9} className="animate-spin" />
                    <span>Preparing download...</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full w-1/3 animate-pulse"
                      style={{ background: 'linear-gradient(90deg, #22c55e, #34d399)' }} />
                  </div>
                </div>
              )}

              {/* Error message */}
              {state?.error && (
                <div className="mb-2 text-[9px] p-1.5 rounded" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                  <AlertTriangle size={9} className="inline mr-1" />
                  {state.error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {isActive ? (
                  <button onClick={handleUnload}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <XCircle size={10} /> Unload
                  </button>
                ) : (
                  <button
                    onClick={() => handleLoadModel(model.id)}
                    disabled={isLoading || (compat?.level === 'insufficient')}
                    title={compat?.level === 'insufficient' ? 'Your device does not meet the requirements to run this model' : undefined}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: compat?.level === 'insufficient'
                        ? 'rgba(113,113,122,0.1)'
                        : isLoading ? 'var(--gia-bg-2)' : 'rgba(34,197,94,0.1)',
                      color: compat?.level === 'insufficient'
                        ? 'var(--gia-muted-2)'
                        : isLoading ? 'var(--gia-muted)' : '#22c55e',
                      border: `1px solid ${
                        compat?.level === 'insufficient' ? 'var(--gia-border)'
                        : isLoading ? 'var(--gia-border)' : 'rgba(34,197,94,0.2)'
                      }`,
                      cursor: compat?.level === 'insufficient' ? 'not-allowed' : 'pointer',
                      opacity: compat?.level === 'insufficient' ? 0.6 : 1,
                    }}>
                    {compat?.level === 'insufficient' ? (
                      <><ShieldAlert size={10} /> Insufficient</>
                    ) : isLoading ? (
                      <><RefreshCw size={10} className="animate-spin" /> Downloading...</>
                    ) : state?.status === 'ready' ? (
                      <><Zap size={10} /> Load Model</>
                    ) : (
                      <><Download size={10} /> Download & Load</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeModelId && (
        <div className="text-[10px] text-center py-1 px-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', color: '#34d399' }}>
          Active: {LOCAL_LLM_MODELS.find(m => m.id === activeModelId)?.label || activeModelId}
          {' · '}Switch to <strong>local-llm</strong> provider in Engine Room to use it
        </div>
      )}
    </div>
  );
};
