import React, { useState, useEffect, useCallback } from 'react';
import { Download, AlertTriangle, CheckCircle, RefreshCw, Cpu, HardDrive, Zap, XCircle } from 'lucide-react';
import LocalLLMService, { LOCAL_LLM_MODELS, type LocalModelId, type LocalLLMState } from '../../services/LocalLLMService';

type ModelStatusKey = 'not_loaded' | 'loading' | 'ready' | 'error';

const STATUS_CONFIG: Record<ModelStatusKey, { label: string; color: string; bg: string }> = {
  not_loaded: { label: 'Not Downloaded', color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
  loading:    { label: 'Downloading',   color: '#fbbf24',  bg: 'rgba(251,191,36,0.1)' },
  ready:      { label: 'Ready',         color: '#34d399',  bg: 'rgba(52,211,153,0.1)' },
  error:      { label: 'Error',         color: '#f87171',  bg: 'rgba(248,113,113,0.1)' },
};

export const LocalModelsSection: React.FC = () => {
  const service = LocalLLMService;

  // ── State ──────────────────────────────────────────────────────
  const [statuses, setStatuses] = useState<Record<string, LocalLLMState>>(() => service.getStatus());
  const [downloading, setDownloading] = useState<LocalModelId | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeModelId, setActiveModelId] = useState<LocalModelId | null>(() => service.getLoadedModel());

  // ── Refresh ────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    setStatuses(service.getStatus());
    setActiveModelId(service.getLoadedModel());
  }, [service]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // ── Download/load model ────────────────────────────────────────
  const handleLoadModel = useCallback(async (modelId: LocalModelId) => {
    setDownloading(modelId);
    try {
      await service.loadModel(modelId);
      setActiveModelId(modelId);
    } catch {
      // error logged by service
    } finally {
      setDownloading(null);
      refresh();
    }
  }, [service, refresh]);

  // ── Unload model ───────────────────────────────────────────────
  const handleUnload = useCallback(() => {
    service.unload();
    setActiveModelId(null);
    refresh();
  }, [service, refresh]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Cpu size={14} style={{ color: '#22c55e' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Local LLM Models
        </span>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="ml-auto p-1 rounded hover:bg-zinc-800 transition-colors"
          title="Refresh status"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Explanation banner */}
      <div className="px-3 py-2 rounded-xl text-[11px] leading-relaxed" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', color: '#86efac' }}>
        <p className="font-medium mb-1">🧠 On-Device LLM</p>
        <p>These models run <strong>100% locally on your device</strong> using your device's CPU/GPU via ONNX runtime. Select a model and it will be downloaded to your device storage. Once loaded, set <strong>local-llm</strong> as your active provider in the Engine Room to use it for all chat interactions.</p>
      </div>

      {/* Model cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {LOCAL_LLM_MODELS.map((model) => {
          const state = statuses[model.id];
          const statusKey: ModelStatusKey = (state?.status || 'not_loaded') as ModelStatusKey;
          const cfg = STATUS_CONFIG[statusKey];
          const isActive = activeModelId === model.id;
          const isLoading = downloading === model.id;

          return (
            <div
              key={model.id}
              className="rounded-xl p-3 transition-all"
              style={{
                background: isActive ? 'rgba(34,197,94,0.06)' : 'var(--gia-bg-2)',
                border: `1px solid ${isActive ? 'rgba(34,197,94,0.2)' : 'var(--gia-border)'}`,
              }}
            >
              {/* Model header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
                    {model.label}
                  </p>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                    {model.description}
                  </p>
                </div>
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
                <span className="flex items-center gap-1">
                  <Zap size={9} /> {model.parameters} params
                </span>
                <span className="flex items-center gap-1">
                  <Download size={9} /> {model.downloadSize}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive size={9} /> {model.ramEstimate} RAM
                </span>
              </div>

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
                  <button
                    onClick={handleUnload}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <XCircle size={10} /> Unload
                  </button>
                ) : (
                  <button
                    onClick={() => handleLoadModel(model.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: isLoading ? 'var(--gia-bg-2)' : 'rgba(34,197,94,0.1)',
                      color: isLoading ? 'var(--gia-muted)' : '#22c55e',
                      border: `1px solid ${isLoading ? 'var(--gia-border)' : 'rgba(34,197,94,0.2)'}`,
                    }}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={10} className="animate-spin" />
                        Downloading...
                      </>
                    ) : state?.status === 'ready' ? (
                      <>
                        <Zap size={10} /> Load Model
                      </>
                    ) : (
                      <>
                        <Download size={10} /> Download & Load
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note about active model */}
      {activeModelId && (
        <div className="text-[10px] text-center py-1 px-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', color: '#34d399' }}>
          Active: {LOCAL_LLM_MODELS.find(m => m.id === activeModelId)?.label || activeModelId}
          {' · '}Switch to <strong>local-llm</strong> provider in Engine Room to use it
        </div>
      )}
    </div>
  );
};
