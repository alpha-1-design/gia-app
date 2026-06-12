import { logger } from '../../utils/logger';
import GiaBrain from '../GiaBrain';
import visionService from '../VisionService';
import type { BrainRequest } from '../providers/types';

// ── Types ───────────────────────────────────────────────────────────

export type VisionTask = 'caption' | 'ocr' | 'detect' | 'classify';

export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error';

export interface ModelStatusEntry {
  status: ModelStatus;
  modelId: string;
  downloadSizeEstimate: string;
  error?: string;
}

export interface ProcessedImageResult {
  result: string | Record<string, unknown>;
  source: 'local' | 'provider';
  confidence: number;
  latencyMs: number;
  modelUsed: string;
}

export interface VisionRouterStats {
  localCalls: number;
  providerCalls: number;
  localErrors: number;
  providerErrors: number;
  avgLocalLatency: number;
  avgProviderLatency: number;
}

export interface VisionRouterCapabilities {
  local: string[];
  provider: string[];
}

// ── Model metadata ──────────────────────────────────────────────────

interface ModelMeta {
  id: string;
  task: VisionTask;
  label: string;
  downloadSize: string;
}

const LOCAL_MODELS: ModelMeta[] = [
  { id: 'Xenova/vit-gpt2-image-captioning', task: 'caption', label: 'Image Captioning', downloadSize: '~340 MB' },
  { id: 'Xenova/trocr-base-printed',         task: 'ocr',     label: 'OCR (Printed Text)', downloadSize: '~340 MB' },
  { id: 'Xenova/detr-resnet-50',              task: 'detect',  label: 'Object Detection',   downloadSize: '~170 MB' },
  { id: 'Xenova/resnet-50',                   task: 'classify', label: 'Image Classification', downloadSize: '~100 MB' },
];

// ── VisionRouter ────────────────────────────────────────────────────

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

class VisionRouter {
  private static instance: VisionRouter;

  /** Master toggle — set to false to disable the entire router. */
  enabled = true;

  /** Confidence threshold below which local results trigger fallback. */
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD;

  /** When true, provider fallback is allowed. */
  fallbackEnabled = true;

  /** Per-model status map. */
  modelStatus: Record<string, ModelStatusEntry> = {};

  /** Running statistics. */
  stats: VisionRouterStats = {
    localCalls: 0,
    providerCalls: 0,
    localErrors: 0,
    providerErrors: 0,
    avgLocalLatency: 0,
    avgProviderLatency: 0,
  };

  /** Latency accumulators for rolling average. */
  private _localLatencyTotal = 0;
  private _providerLatencyTotal = 0;

  private constructor() {
    // Initialise status for every known model
    for (const m of LOCAL_MODELS) {
      this.modelStatus[m.id] = {
        status: 'not_loaded',
        modelId: m.id,
        downloadSizeEstimate: m.downloadSize,
      };
    }
    // Refresh actual status from VisionService cache
    this._syncStatus();
  }

  static getInstance(): VisionRouter {
    if (!this.instance) this.instance = new VisionRouter();
    return this.instance;
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Return current status for all vision models.
   */
  getStatus(): Record<string, ModelStatusEntry> {
    this._syncStatus();
    return { ...this.modelStatus };
  }

  /**
   * Return what the router is capable of.
   */
  getCapabilities(): VisionRouterCapabilities {
    return {
      local: LOCAL_MODELS.map(m => `${m.label} (${m.id})`),
      provider: ['GPT-4o', 'Gemini Pro Vision', 'Claude 3 Vision', 'other vision-capable provider models'],
    };
  }

  /**
   * Process an image through the vision pipeline.
   *
   * 1. Try local ONNX model (from VisionService)
   * 2. If confidence < threshold OR model errored AND fallback is enabled → call provider
   * 3. Return result with source metadata
   */
  async processImage(
    imageUrl: string,
    task: VisionTask,
  ): Promise<ProcessedImageResult> {
    if (!this.enabled) {
      throw new Error('VisionRouter is disabled');
    }

    // ── Step 1: Try local ──────────────────────────────────────────
    const localModel = LOCAL_MODELS.find(m => m.task === task);
    if (!localModel) {
      throw new Error(`Unknown vision task: ${task}`);
    }

    // Mark loading if not already
    if (this.modelStatus[localModel.id]?.status === 'not_loaded') {
      this.modelStatus[localModel.id] = { ...this.modelStatus[localModel.id], status: 'loading' };
    }

    const localStart = performance.now();
    let localResult: ProcessedImageResult | null = null;

    try {
      localResult = await this._runLocal(imageUrl, task, localModel);
      this.stats.localCalls++;
      const latency = Math.round(performance.now() - localStart);
      this._localLatencyTotal += latency;
      this.stats.avgLocalLatency = Math.round(this._localLatencyTotal / this.stats.localCalls);

      // If confidence meets threshold, return local result
      if (localResult.confidence >= this.confidenceThreshold) {
        return { ...localResult, latencyMs: latency };
      }

      logger.log(`[VisionRouter] Local confidence ${localResult.confidence} < threshold ${this.confidenceThreshold} — considering fallback`);
    } catch (err) {
      this.stats.localErrors++;
      this.modelStatus[localModel.id] = {
        ...this.modelStatus[localModel.id],
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      logger.error(`[VisionRouter] Local ${task} failed:`, err);
    }

    // ── Step 2: Provider fallback ──────────────────────────────────
    if (!this.fallbackEnabled || !localResult) {
      // No fallback available — return whatever local gave us (even if degraded)
      if (localResult) return localResult;
      throw new Error(`Local ${task} failed and fallback is disabled`);
    }

    const providerStart = performance.now();
    try {
      const providerResult = await this._runProvider(imageUrl, task);
      this.stats.providerCalls++;
      const latency = Math.round(performance.now() - providerStart);
      this._providerLatencyTotal += latency;
      this.stats.avgProviderLatency = Math.round(this._providerLatencyTotal / this.stats.providerCalls);
      return { ...providerResult, latencyMs: latency };
    } catch (err) {
      this.stats.providerErrors++;
      logger.error(`[VisionRouter] Provider fallback ${task} failed:`, err);
      // If local gave us something (even low confidence), return it as last resort
      if (localResult) return localResult;
      throw new Error(`Both local and provider ${task} failed`);
    }
  }

  /**
   * Download / warm-up all local models by loading each pipeline once.
   * Updates status as each model is loaded.
   */
  async downloadAllModels(): Promise<void> {
    const results = await Promise.allSettled(
      LOCAL_MODELS.map(async (m) => {
        this.modelStatus[m.id] = { ...this.modelStatus[m.id], status: 'loading' };
        try {
          // Trigger lazy-loading in VisionService by calling a method that uses the pipeline
          const pipe = await this._getPipeline(m.task);
          this.modelStatus[m.id] = { ...this.modelStatus[m.id], status: pipe ? 'ready' : 'error' };
        } catch (err) {
          this.modelStatus[m.id] = {
            ...this.modelStatus[m.id],
            status: 'error',
            error: err instanceof Error ? err.message : 'Load failed',
          };
        }
      }),
    );

    const loaded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    logger.log(`[VisionRouter] Download models: ${loaded} loaded, ${failed} failed`);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private _syncStatus(): void {
    for (const m of LOCAL_MODELS) {
      const entry = this.modelStatus[m.id];
      if (!entry) continue;

      const isReady = (() => {
        switch (m.task) {
          case 'caption':   return visionService.isCaptionReady();
          case 'ocr':       return visionService.isOCRReady();
          case 'detect':    return visionService.isDetectionReady();
          case 'classify':  return visionService.isClassificationReady();
        }
      })();

      if (isReady && entry.status !== 'error') {
        this.modelStatus[m.id] = { ...entry, status: 'ready' };
      } else if (!isReady && entry.status !== 'loading' && entry.status !== 'error') {
        this.modelStatus[m.id] = { ...entry, status: 'not_loaded' };
      }
    }
  }

  private async _getPipeline(task: VisionTask): Promise<unknown> {
    switch (task) {
      case 'caption':
        // Trigger loading by calling describe on a minimal dummy;
        // the pipeline will be cached internally.
        return (visionService as unknown as { loadPipeline?: (task: string, model: string) => unknown }).loadPipeline?.('image-to-text', 'Xenova/vit-gpt2-image-captioning');
      case 'ocr':
        return (visionService as unknown as { loadPipeline?: (task: string, model: string) => unknown }).loadPipeline?.('image-to-text', 'Xenova/trocr-base-printed');
      case 'detect':
        return (visionService as unknown as { loadPipeline?: (task: string, model: string) => unknown }).loadPipeline?.('object-detection', 'Xenova/detr-resnet-50');
      case 'classify':
        return (visionService as unknown as { loadPipeline?: (task: string, model: string) => unknown }).loadPipeline?.('image-classification', 'Xenova/resnet-50');
    }
  }

  private async _runLocal(
    imageUrl: string,
    task: VisionTask,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    model: ModelMeta,
  ): Promise<ProcessedImageResult> {
    const start = performance.now();

    switch (task) {
      case 'caption': {
        const r = await visionService.describe(imageUrl);
        return {
          result: r.description,
          source: 'local',
          confidence: r.description ? 0.85 : 0,
          latencyMs: Math.round(performance.now() - start),
          modelUsed: r.model,
        };
      }
      case 'ocr': {
        const r = await visionService.ocr(imageUrl);
        return {
          result: r.text,
          source: 'local',
          confidence: r.text ? 0.8 : 0,
          latencyMs: Math.round(performance.now() - start),
          modelUsed: r.model,
        };
      }
      case 'detect': {
        const r = await visionService.detectObjects(imageUrl);
        const topScore = r.objects.length > 0 ? Math.max(...r.objects.map(o => o.score)) : 0;
        return {
          result: { objects: r.objects },
          source: 'local',
          confidence: topScore,
          latencyMs: Math.round(performance.now() - start),
          modelUsed: r.model,
        };
      }
      case 'classify': {
        const r = await visionService.classify(imageUrl);
        return {
          result: { label: r.label, score: r.score },
          source: 'local',
          confidence: r.score,
          latencyMs: Math.round(performance.now() - start),
          modelUsed: r.model,
        };
      }
    }
  }

  private async _runProvider(
    imageUrl: string,
    task: VisionTask,
  ): Promise<ProcessedImageResult> {
    const promptMap: Record<VisionTask, string> = {
      caption: 'Describe this image in a single concise caption.',
      ocr: 'Extract all visible text from this image. Return only the extracted text.',
      detect: 'List all objects you can see in this image as a JSON array of {label, confidence}.',
      classify: 'Classify the main subject of this image. Return a JSON object with label and confidence score.',
    };

    const req: BrainRequest = {
      prompt: promptMap[task],
      images: [{
        name: 'vision-input',
        type: 'image/jpeg',
        // If the imageUrl is already a data URL, use as-is; otherwise assume base64
        data: imageUrl.startsWith('data:') ? imageUrl.split(',')[1] || imageUrl : imageUrl,
      }],
      maxTokens: 500,
      temperature: 0.2,
      // Let GiaBrain handle vision — the images array will cause it to
      // route through the active provider's vision capability or localVision
      localVision: false,
    };

    const res = await GiaBrain.generate(req);

    // Try to extract confidence from response
    let confidence = 0.75; // default for provider results
    if (task === 'detect' || task === 'classify') {
      try {
        const parsed = JSON.parse(res.text);
        if (typeof parsed.confidence === 'number') confidence = parsed.confidence;
        if (typeof parsed.score === 'number') confidence = parsed.score;
      } catch {
        // Non-JSON response — use default confidence
      }
    }

    return {
      result: res.text,
      source: 'provider',
      confidence,
      latencyMs: 0, // filled by caller
      modelUsed: `${res.provider}/${res.model}`,
    };
  }
}

export default VisionRouter.getInstance();
