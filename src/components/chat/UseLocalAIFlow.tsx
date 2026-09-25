import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { detectDeviceCapabilities, recommendModel, type DeviceCapabilities } from '../../services/DeviceCapabilities';
import LocalLLMService, { LOCAL_LLM_MODELS, type LocalModelId, type DownloadProgress } from '../../services/LocalLLMService';
import { useProviderStore } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';

/**
 * UseLocalAIFlow — the "Use Local AI (Free)" one-tap entry point, made
 * device-aware.
 *
 * Before recommending anything it detects what THIS phone can actually run
 * (real RAM via the GIADeviceInfo native plugin, falling back to browser
 * APIs), picks the best model that fits via recommendModel(), explains the
 * choice and its download size, and only then downloads — with live
 * progress — and activates the on-device provider. No more dead end where
 * users activated local AI and hit "No local model loaded" on first send.
 */
export const UseLocalAIFlow: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [phase, setPhase] = React.useState<'detecting' | 'recommend' | 'downloading' | 'error' | 'done'>('detecting');
  const [recommendedId, setRecommendedId] = React.useState<LocalModelId | null>(null);
  const [caps, setCaps] = React.useState<DeviceCapabilities | null>(null);
  const [progress, setProgress] = React.useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = React.useState('');
  const addNotification = useGiaStore(s => s.addNotification);

  // Re-detect every time the flow opens.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase('detecting');
    setProgress(null);
    setErrorMsg('');

    (async () => {
      try {
        // Model already loaded → activate and close; nothing to recommend.
        if (LocalLLMService.isLoaded()) {
          useProviderStore.getState().setProviderKey('local-llm', '');
          addNotification('⚡ On-device AI active — GIA is running fully local');
          onClose();
          return;
        }
        const c = await detectDeviceCapabilities();
        if (cancelled) return;
        setCaps(c);
        const rec = recommendModel(c, LOCAL_LLM_MODELS) as LocalModelId | null;
        if (cancelled) return;
        if (!rec) {
          setErrorMsg('No local model fits this device right now. Connect a cloud provider instead — GIA still works offline for notes, tasks, and files.');
          setPhase('error');
          return;
        }
        setRecommendedId(rec);
        setPhase('recommend');
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : 'Could not detect device capabilities');
          setPhase('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [open, onClose, addNotification]);

  // Live download progress while downloading.
  React.useEffect(() => {
    if (phase !== 'downloading') return;
    const unsub = LocalLLMService.onProgress((_modelId, p) => setProgress(p));
    return unsub;
  }, [phase]);

  const handleDownload = React.useCallback(async () => {
    if (!recommendedId) return;
    setPhase('downloading');
    try {
      useProviderStore.getState().setProviderKey('local-llm', '');
      await LocalLLMService.loadModel(recommendedId);
      const label = LOCAL_LLM_MODELS.find(m => m.id === recommendedId)?.label ?? recommendedId;
      addNotification(`✅ ${label} ready — GIA now works fully offline`);
      setPhase('done');
      setTimeout(onClose, 600);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Download failed — check storage space and connection');
      setPhase('error');
    }
  }, [recommendedId, addNotification, onClose]);

  const meta = recommendedId ? LOCAL_LLM_MODELS.find(m => m.id === recommendedId) : null;
  const ramNote = caps
    ? caps.availableRAMGB < 3
      ? `~${caps.availableRAMGB.toFixed(1)} GB RAM free — a small model avoids slowdowns and Android killing the app`
      : `~${caps.availableRAMGB.toFixed(1)} GB RAM free — this model fits comfortably`
    : '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[190] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={phase === 'downloading' ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-6"
            style={{ background: 'var(--gia-surface, #18181b)', border: '1px solid var(--gia-border, #27272a)' }}
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.18)' }}>
                  <Cpu size={16} style={{ color: '#a855f7' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--gia-text, #f4f4f5)' }}>Use Local AI (Free)</h2>
                  <p className="text-[11px]" style={{ color: 'var(--gia-muted-2, #a1a1aa)' }}>Runs on this phone — no API key, works offline</p>
                </div>
              </div>
              {phase !== 'downloading' && (
                <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted, #71717a)' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {phase === 'detecting' && (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--gia-muted)' }}>Checking what this device can run…</p>
            )}

            {phase === 'recommend' && meta && (
              <>
                <div className="rounded-xl p-3.5 mb-3" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--gia-text, #f4f4f5)' }}>Recommended for your phone: {meta.label}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{meta.description}</p>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--gia-muted-2)' }}>
                    {ramNote} · Download: {meta.downloadSize} · Needs {meta.ramEstimate} RAM
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all tap-feedback active:scale-[0.98]"
                  style={{ background: '#a855f7', color: '#faf5ff' }}
                >
                  Download & use on-device
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2 mt-1 text-[11px]"
                  style={{ color: 'var(--gia-muted-2, #a1a1aa)' }}
                >
                  Not now
                </button>
              </>
            )}

            {phase === 'downloading' && meta && (
              <>
                <p className="text-xs mb-3" style={{ color: 'var(--gia-text, #f4f4f5)' }}>
                  Downloading {meta.label}… {progress?.percent != null ? `${Math.round(progress.percent)}%` : ''}
                </p>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--gia-border, #3f3f46)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, progress?.percent ?? 0)}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }}
                  />
                </div>
                <p className="text-[10px]" style={{ color: 'var(--gia-muted-2, #a1a1aa)' }}>
                  One-time download — after this GIA answers fully offline. Keep the app open.
                </p>
              </>
            )}

            {phase === 'done' && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                <p className="text-xs font-medium" style={{ color: '#34d399' }}>Model ready — you're on-device now</p>
              </div>
            )}

            {phase === 'error' && (
              <>
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--gia-text, #f4f4f5)' }}>{errorMsg}</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--gia-surface-2, #27272a)', color: 'var(--gia-text, #f4f4f5)', border: '1px solid var(--gia-border, #3f3f46)' }}
                >
                  Got it
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UseLocalAIFlow;
