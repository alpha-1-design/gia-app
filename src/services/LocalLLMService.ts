import { logger } from '../utils/logger';

// ── Types ───────────────────────────────────────────────────────────

export type LocalModelId =
  | 'Xenova/Qwen2.5-0.5B-Instruct'
  | 'Xenova/Qwen2.5-1.5B-Instruct'
  | 'Xenova/Qwen2.5-3B-Instruct';

export interface LocalLLMMeta {
  id: LocalModelId;
  label: string;
  description: string;
  downloadSize: string;
  ramEstimate: string;
  parameters: string;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
  file?: string;
}

export type ModelLoadStatus = 'not_loaded' | 'loading' | 'ready' | 'error';

export interface LocalLLMState {
  status: ModelLoadStatus;
  modelId: LocalModelId;
  error?: string;
}

export interface LocalLLMGenerateOptions {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export interface LocalLLMGenerateResult {
  text: string;
  model: LocalModelId;
  tokensPerSecond: number;
  totalTokens: number;
  timeMs: number;
  finishReason: 'stop' | 'length' | 'error';
}

// ── Model Catalog ───────────────────────────────────────────────────

export const LOCAL_LLM_MODELS: LocalLLMMeta[] = [
  {
    id: 'Xenova/Qwen2.5-0.5B-Instruct',
    label: 'Qwen2.5 0.5B (Lightning)',
    description: 'Fastest option. Good for simple chat, Q&A, and writing. Best battery life.',
    downloadSize: '~1 GB',
    ramEstimate: '~1.2 GB',
    parameters: '0.5B',
  },
  {
    id: 'Xenova/Qwen2.5-1.5B-Instruct',
    label: 'Qwen2.5 1.5B (Balanced)',
    description: 'Best quality-size trade-off. Handles complex instructions, reasoning, and creative writing.',
    downloadSize: '~3 GB',
    ramEstimate: '~3 GB',
    parameters: '1.5B',
  },
  {
    id: 'Xenova/Qwen2.5-3B-Instruct',
    label: 'Qwen2.5 3B (Ultra)',
    description: 'Most capable local model. Better at following complex instructions and reasoning tasks.',
    downloadSize: '~6 GB',
    ramEstimate: '~6 GB',
    parameters: '3B',
  },
];

// ── Service ─────────────────────────────────────────────────────────

class LocalLLMService {
  private static instance: LocalLLMService;

  /** Generated text pipeline (lazy-loaded). */
  private _pipeline: ((messages: { role: string; content: string }[], opts?: Record<string, unknown>) => Promise<{ generated_text: { role: string; content: string }[] }[]>) | null = null;

  /** Current loaded model. */
  private _loadedModel: LocalModelId | null = null;

  /** Cached tokenizer/processor for chat template. */
  private _processor: unknown | null = null;

  /** Per-model status. */
  private _status: Record<LocalModelId, LocalLLMState>;

  /** Download progress per model. */
  private _progress: Record<string, DownloadProgress> = {};

  /** Callbacks for progress updates. */
  private _progressCallbacks: Set<(modelId: string, progress: DownloadProgress) => void> = new Set();

  private _loading = false;
  private _loadPromise: Promise<void> | null = null;

  private constructor() {
    this._status = {} as Record<LocalModelId, LocalLLMState>;
    for (const m of LOCAL_LLM_MODELS) {
      (this._status as Record<string, LocalLLMState>)[m.id] = {
        status: 'not_loaded',
        modelId: m.id,
      };
    }
  }

  static getInstance(): LocalLLMService {
    if (!this.instance) this.instance = new LocalLLMService();
    return this.instance;
  }

  /** Unload the current model and free memory. */
  async unloadModel(): Promise<void> {
    if (this._loading && this._loadPromise) {
      await this._loadPromise;
    }
    this._unload();
  }

  // ── Public API ──────────────────────────────────────────────────

  onProgress(cb: (modelId: string, progress: DownloadProgress) => void): () => void {
    this._progressCallbacks.add(cb);
    return () => this._progressCallbacks.delete(cb);
  }

  getProgress(modelId: string): DownloadProgress | undefined {
    return this._progress[modelId];
  }

  getStatus(): Record<string, LocalLLMState> {
    return { ...this._status as Record<string, LocalLLMState> };
  }

  getLoadedModel(): LocalModelId | null {
    return this._loadedModel;
  }

  isLoaded(): boolean {
    return this._pipeline !== null;
  }

  /**
   * Download (load) a specific model. If already loaded with a different model,
   * unloads the old one first.
   */
  async loadModel(modelId: LocalModelId): Promise<void> {
    if (this._loadedModel === modelId && this.isLoaded()) {
      this._setStatus(modelId, 'ready');
      return;
    }

    if (this._loading) {
      if (this._loadPromise) await this._loadPromise;
      return;
    }

    this._loading = true;

    // Clear previous model if different
    if (this._loadedModel && this._loadedModel !== modelId) {
      this._unload();
    }

    this._setStatus(modelId, 'loading');

    this._loadPromise = (async () => {
      try {
        const mod = await import('@huggingface/transformers');
        const hfToken = typeof window !== 'undefined' ? localStorage.getItem('gia:vision:hfToken') || undefined : undefined;
        const pipe = await mod.pipeline('text-generation', modelId, {
          dtype: 'q4',
          ...(hfToken ? { access_token: hfToken } : {}),
          progress_callback: (p: { status: string; file: string; loaded: number; total: number }) => {
            if (p.status === 'progress' || p.status === 'initiate') {
              const progress: DownloadProgress = {
                loaded: p.loaded || 0,
                total: p.total || 0,
                percent: p.total ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0,
                file: p.file,
              };
              this._progress[modelId] = progress;
              this._progressCallbacks.forEach(cb => cb(modelId, progress));
            }
          },
        } as never);
        this._pipeline = pipe as typeof this._pipeline;
        this._loadedModel = modelId;
        this._setStatus(modelId, 'ready');
        delete this._progress[modelId];
        logger.log(`[LocalLLM] Loaded ${modelId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[LocalLLM] Failed to load ${modelId}:`, err);
        this._setStatus(modelId, 'error', msg);
        delete this._progress[modelId];
        throw err;
      } finally {
        this._loading = false;
        this._loadPromise = null;
      }
    })();

    await this._loadPromise;
  }

  /**
   * Generate a response from the loaded model.
   * Throws if no model is loaded.
   */
  async generate(options: LocalLLMGenerateOptions): Promise<LocalLLMGenerateResult> {
    if (!this._pipeline || !this._loadedModel) {
      throw new Error('No local LLM loaded. Download and load a model in Settings first.');
    }

    const startTime = performance.now();
    let totalTokens = 0;
    let fullText = '';

    // Build messages array for the pipeline
    const messages = options.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const generateOpts: Record<string, unknown> = {
      max_new_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      do_sample: (options.temperature ?? 0.7) > 0,
      repetition_penalty: 1.1,
    };

    if (options.signal) {
      generateOpts.signal = options.signal;
    }

    // ── HuggingFace Access Token (for gated / private models) ──────
    const hfToken = localStorage.getItem('gia:vision:hfToken') || '';
    if (hfToken) {
      generateOpts.access_token = hfToken;
    }

    try {
      // The text-generation pipeline returns full message array with new assistant response appended
      const result = await this._pipeline(messages, generateOpts);

      // Extract the assistant's reply (last message)
      const lastMsg = result?.[0]?.generated_text?.at?.(-1);
      fullText = lastMsg?.content || '';

      if (options.onToken) {
        // ONNX generates all at once — deliver in chunks for pseudo-streaming UX
        const chunkSize = 8;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          if (options.signal?.aborted) break;
          options.onToken(fullText.slice(0, i + chunkSize));
          await new Promise(r => setTimeout(r, 16));
        }
        if (!options.signal?.aborted) options.onToken(fullText);
      }

      totalTokens = this._estimateTokens(fullText);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          text: fullText || '',
          model: this._loadedModel,
          tokensPerSecond: 0,
          totalTokens,
          timeMs: Math.round(performance.now() - startTime),
          finishReason: 'error',
        };
      }
      logger.error('[LocalLLM] Generation error:', err);
      throw err;
    }

    const elapsed = Math.round(performance.now() - startTime);
    const tps = totalTokens > 0 && elapsed > 0 ? Math.round((totalTokens / elapsed) * 1000) : 0;

    return {
      text: fullText,
      model: this._loadedModel,
      tokensPerSecond: tps,
      totalTokens,
      timeMs: elapsed,
      finishReason: fullText ? 'stop' : 'error',
    };
  }

  /**
   * Unload the current model to free memory.
   */
  unload(): void {
    this._unload();
  }

  // ── Private ─────────────────────────────────────────────────────

  private _unload(): void {
    if (this._loadedModel) {
      this._setStatus(this._loadedModel, 'not_loaded');
    }
    this._pipeline = null;
    this._processor = null;
    this._loadedModel = null;
    // Force GC hint
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }
    logger.log('[LocalLLM] Unloaded model');
  }

  private _setStatus(modelId: LocalModelId, status: ModelLoadStatus, error?: string): void {
    (this._status as Record<string, LocalLLMState>)[modelId] = {
      ...(this._status as Record<string, LocalLLMState>)[modelId] || { modelId },
      status,
      modelId,
      error,
    };
  }

  /**
   * Rough token estimate (chars / 4) — actual tokenizer would be better
   * but for speed display this is fine.
   */
  private _estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.round(text.length / 4);
  }
}

export default LocalLLMService.getInstance();
