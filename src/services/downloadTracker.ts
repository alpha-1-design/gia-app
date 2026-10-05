import LocalLLMService, { LOCAL_LLM_MODELS } from './LocalLLMService';
import { useDownloadStore } from '../store/useDownloadStore';
import { useGiaStore } from '../store/useGiaStore';
import { logger } from '../utils/logger';
import { parseSizeLabel } from '../utils/downloadProgress';

let started = false;

function labelFor(modelId: string): string {
  return LOCAL_LLM_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}

async function alertDone(label: string, ok: boolean, error?: string) {
  const text = ok ? `${label} is ready` : `${label} download failed${error ? `: ${error}` : ''}`;
  useGiaStore.getState().addNotification(text);
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({ notifications: [{ id: Date.now() % 100000, title: ok ? 'Download complete' : 'Download failed', body: text }] });
  } catch (e) {
    logger.warn('[downloadTracker] could not post a system notification', e);
  }
}

/** Mirrors local-model downloads into useDownloadStore. Safe to call more than once. */
export function startDownloadTracking(): void {
  if (started) return;
  started = true;
  const store = useDownloadStore;

  LocalLLMService.onProgress((modelId, p) => {
    if (!p.file) return;
    const meta = LOCAL_LLM_MODELS.find(m => m.id === modelId);
    store.getState().report(modelId, labelFor(modelId), p.file, { loaded: p.loaded, total: p.total }, parseSizeLabel(meta?.downloadSize));
  });

  LocalLLMService.onStatusChange((modelId, state) => {
    const task = store.getState().tasks[modelId];
    if (!task || task.status !== 'running') return;
    if (state.status === 'ready' || state.status === 'downloaded') {
      store.getState().finish(modelId);
      void alertDone(task.label, true);
    } else if (state.status === 'error') {
      store.getState().fail(modelId, state.error ?? 'Unknown error');
      void alertDone(task.label, false, state.error);
    }
  });
}
