import { logger } from '../utils/logger';

export type WhisperModelId = 'Xenova/whisper-tiny.en' | 'Xenova/whisper-base.en';

export type WhisperStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface WhisperProgress {
  /** 0-100 across every file of the model, or null until sizes are known. */
  percent: number | null;
  loadedBytes: number;
  totalBytes: number;
  /** File currently downloading, for display. */
  file: string;
}

type Listener = () => void;

/** transformers.js stores downloaded model files in the Cache API under this key. */
const CACHE_KEY = 'transformers-cache';

const IDLE_PROGRESS: WhisperProgress = { percent: null, loadedBytes: 0, totalBytes: 0, file: '' };

class WhisperService {
  private static instance: WhisperService;
  static getInstance() {
    if (!this.instance) this.instance = new WhisperService();
    return this.instance;
  }

  private transcriber: ((audio: Float32Array | Blob) => Promise<{ text: string }>) | null = null;
  private _modelId: WhisperModelId = 'Xenova/whisper-tiny.en';
  private _status: WhisperStatus = 'unloaded';
  private _loading = false;
  private _progress: WhisperProgress = IDLE_PROGRESS;
  private _error = '';
  private listeners = new Set<Listener>();
  private files = new Map<string, { loaded: number; total: number }>();

  get status() { return this._status; }
  get modelId() { return this._modelId; }
  get isReady() { return this._status === 'ready' && this.transcriber !== null; }
  get progress() { return this._progress; }
  /** Human-readable reason for the last failed load, '' if none. */
  get error() { return this._error; }

  /** Subscribe to status/progress changes. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit() {
    this.listeners.forEach(fn => { try { fn(); } catch { /* a bad listener must not break loading */ } });
  }

  private onProgress = (ev: { status?: string; file?: string; name?: string; loaded?: number; total?: number }) => {
    const file = ev.file || ev.name || '';
    if (!file) return;
    if (ev.status === 'progress' || ev.status === 'download') {
      const prev = this.files.get(file);
      this.files.set(file, {
        loaded: ev.loaded ?? prev?.loaded ?? 0,
        total: ev.total ?? prev?.total ?? 0,
      });
    } else if (ev.status === 'done') {
      const prev = this.files.get(file);
      if (prev && prev.total) this.files.set(file, { loaded: prev.total, total: prev.total });
    } else {
      return;
    }
    let loaded = 0;
    let total = 0;
    this.files.forEach(f => { loaded += f.loaded; total += f.total; });
    this._progress = {
      percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null,
      loadedBytes: loaded,
      totalBytes: total,
      file,
    };
    this.emit();
  };

  async loadModel(modelId: WhisperModelId = 'Xenova/whisper-tiny.en'): Promise<void> {
    if (this.isReady && this._modelId === modelId) return;
    if (this._loading) return;

    this._loading = true;
    this._modelId = modelId;
    this._status = 'loading';
    this._error = '';
    this.files.clear();
    this._progress = IDLE_PROGRESS;
    this.emit();

    try {
      const mod = await import('@huggingface/transformers');
      this.transcriber = await mod.pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
        progress_callback: this.onProgress,
      } as never) as typeof this.transcriber;

      this._status = 'ready';
      logger.log(`[Whisper] Loaded ${modelId}`);
    } catch (err) {
      this._status = 'error';
      this._error = err instanceof Error ? err.message : String(err);
      logger.error('[Whisper] Failed to load model:', err);
      throw err;
    } finally {
      this._loading = false;
      this.emit();
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.isReady || !this.transcriber) {
      throw new Error('Whisper model not loaded');
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    const result = await this.transcriber(channelData as never);
    return result.text.trim();
  }

  /** Free the model from memory. The downloaded files stay on disk — see deleteModel(). */
  async unload(): Promise<void> {
    this.transcriber = null;
    this._status = 'unloaded';
    this._progress = IDLE_PROGRESS;
    this.emit();
  }

  private async matchingCacheEntries(): Promise<{ cache: Cache; requests: Request[] } | null> {
    if (typeof caches === 'undefined') return null;
    if (!(await caches.has(CACHE_KEY))) return null;
    const cache = await caches.open(CACHE_KEY);
    const keys = await cache.keys();
    // Match both model ids, so "delete" also clears a previously used base.en.
    const requests = keys.filter(r => r.url.includes('whisper-'));
    return { cache, requests };
  }

  /** Bytes of Whisper model files currently stored on this device. */
  async getCachedBytes(): Promise<number> {
    try {
      const found = await this.matchingCacheEntries();
      if (!found) return 0;
      let total = 0;
      for (const req of found.requests) {
        const res = await found.cache.match(req);
        if (!res) continue;
        const len = Number(res.headers.get('content-length'));
        total += Number.isFinite(len) && len > 0 ? len : (await res.clone().blob()).size;
      }
      return total;
    } catch (err) {
      logger.warn('[Whisper] Could not measure cache:', err);
      return 0;
    }
  }

  /**
   * Remove the model from memory AND delete its downloaded files, so the next
   * download starts clean. Returns how many bytes were freed.
   */
  async deleteModel(): Promise<number> {
    await this.unload();
    this._error = '';
    this.files.clear();
    let freed = 0;
    try {
      const found = await this.matchingCacheEntries();
      if (found) {
        freed = await this.getCachedBytes();
        await Promise.all(found.requests.map(r => found.cache.delete(r)));
      }
    } catch (err) {
      logger.error('[Whisper] Failed to delete cached model:', err);
      throw err;
    } finally {
      this.emit();
    }
    return freed;
  }
}

export default WhisperService.getInstance();
