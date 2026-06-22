import { logger } from '../utils/logger';

export interface VisionResult {
  description: string;
  model: string;
  timeMs: number;
}

export interface OCRResult {
  text: string;
  model: string;
  timeMs: number;
}

export interface DetectedObject {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export interface ObjectDetectionResult {
  objects: DetectedObject[];
  model: string;
  timeMs: number;
}

export interface ClassificationResult {
  label: string;
  score: number;
  model: string;
  timeMs: number;
}

export interface ComprehensiveVisionAnalysis {
  caption: VisionResult | null;
  ocr: OCRResult | null;
  objects: ObjectDetectionResult | null;
  classification: ClassificationResult | null;
  totalTimeMs: number;
}

class VisionService {
  private static instance: VisionService;

  private pipelineCache = new Map<string, unknown>();

  private _loading = new Set<string>();

  private _captionModelId = 'Xenova/vit-gpt2-image-captioning';
  private _ocrModelId = 'Xenova/trocr-base-printed';
  private _detectionModelId = 'Xenova/detr-resnet-50';
  private _classificationModelId = 'Xenova/resnet-50';

  static getInstance() {
    if (!this.instance) this.instance = new VisionService();
    return this.instance;
  }

  get captionModelId() { return this._captionModelId; }
  get ocrModelId() { return this._ocrModelId; }
  get detectionModelId() { return this._detectionModelId; }
  get classificationModelId() { return this._classificationModelId; }

  private async loadPipeline(task: string, modelId: string): Promise<unknown> {
    const key = `${task}:${modelId}`;
    if (this.pipelineCache.has(key)) return this.pipelineCache.get(key);
    if (this._loading.has(key)) {
      let waited = 0;
      while (this._loading.has(key) && waited < 30000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
      return this.pipelineCache.get(key);
    }
    this._loading.add(key);
    try {
      const mod = await import('@huggingface/transformers');
      const pipe = await (mod.pipeline as (task: string, modelId: string) => Promise<unknown>)(task, modelId);
      this.pipelineCache.set(key, pipe);
      logger.log(`[VisionService] Loaded: ${task} with ${modelId}`);
      return pipe;
    } catch (e) {
      logger.error(`[VisionService] Failed to load ${task}/${modelId}:`, e);
      throw e;
    } finally {
      this._loading.delete(key);
    }
  }

  ready(task: string, modelId: string): boolean {
    return this.pipelineCache.has(`${task}:${modelId}`);
  }

  isCaptionReady() { return this.ready('image-to-text', this._captionModelId); }
  isOCRReady() { return this.ready('image-to-text', this._ocrModelId); }
  isDetectionReady() { return this.ready('object-detection', this._detectionModelId); }
  isClassificationReady() { return this.ready('image-classification', this._classificationModelId); }

  private async imageFromData(data: string): Promise<HTMLImageElement> {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image'));
    });
    img.src = data;
    await loaded;
    return img;
  }

  // --- Captioning ---

  async describe(imageData: string): Promise<VisionResult> {
    const start = performance.now();
    let pipe: unknown;
    try {
      pipe = await this.loadPipeline('image-to-text', this._captionModelId);
      const img = await this.imageFromData(imageData);
      const result = await (pipe as { (input: HTMLCanvasElement | HTMLImageElement): Promise<Array<{ generated_text?: string }>> })(img);
      const description = result?.[0]?.generated_text || '';
      return {
        description: description.trim(),
        model: this._captionModelId,
        timeMs: Math.round(performance.now() - start),
      };
    } catch (e) {
      logger.error('[VisionService] describe failed:', e);
      return { description: '', model: this._captionModelId, timeMs: Math.round(performance.now() - start) };
    }
  }

  async describeImageData(data: string): Promise<VisionResult> {
    return this.describe(data);
  }

  // --- OCR ---

  async ocr(imageData: string): Promise<OCRResult> {
    const start = performance.now();
    try {
      const pipe = await this.loadPipeline('image-to-text', this._ocrModelId);
      const img = await this.imageFromData(imageData);
      const result = await (pipe as { (input: HTMLCanvasElement | HTMLImageElement): Promise<Array<{ generated_text?: string }>> })(img);
      const text = result?.[0]?.generated_text || '';
      return {
        text: text.trim(),
        model: this._ocrModelId,
        timeMs: Math.round(performance.now() - start),
      };
    } catch (e) {
      logger.error('[VisionService] OCR failed:', e);
      return { text: '', model: this._ocrModelId, timeMs: Math.round(performance.now() - start) };
    }
  }

  // --- Object Detection ---

  async detectObjects(imageData: string): Promise<ObjectDetectionResult> {
    const start = performance.now();
    try {
      const pipe = await this.loadPipeline('object-detection', this._detectionModelId);
      const img = await this.imageFromData(imageData);
      const result = await (pipe as { (input: HTMLCanvasElement | HTMLImageElement): Promise<Array<{ label?: string; score?: number; box?: { xmin: number; ymin: number; xmax: number; ymax: number } }>> })(img);
      const objects = (result || []).map(r => ({
        label: r.label ?? '',
        score: Math.round((r.score ?? 0) * 100) / 100,
        box: r.box ?? { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
      }));
      return {
        objects,
        model: this._detectionModelId,
        timeMs: Math.round(performance.now() - start),
      };
    } catch (e) {
      logger.error('[VisionService] detectObjects failed:', e);
      return { objects: [], model: this._detectionModelId, timeMs: Math.round(performance.now() - start) };
    }
  }

  // --- Image Classification ---

  async classify(imageData: string): Promise<ClassificationResult> {
    const start = performance.now();
    try {
      const pipe = await this.loadPipeline('image-classification', this._classificationModelId);
      const img = await this.imageFromData(imageData);
      const result = await (pipe as { (input: HTMLCanvasElement | HTMLImageElement): Promise<Array<{ label?: string; score?: number }>> })(img);
      const top = result?.[0];
      return {
        label: top?.label || 'unknown',
        score: top?.score ? Math.round(top.score * 100) / 100 : 0,
        model: this._classificationModelId,
        timeMs: Math.round(performance.now() - start),
      };
    } catch (e) {
      logger.error('[VisionService] classify failed:', e);
      return { label: '', score: 0, model: this._classificationModelId, timeMs: Math.round(performance.now() - start) };
    }
  }

  // --- Run all vision models in parallel ---

  async analyze(imageData: string): Promise<ComprehensiveVisionAnalysis> {
    const overallStart = performance.now();
    const [caption, ocr, objects, classification] = await Promise.allSettled([
      this.describe(imageData),
      this.ocr(imageData),
      this.detectObjects(imageData),
      this.classify(imageData),
    ]);
    return {
      caption: caption.status === 'fulfilled' ? caption.value : null,
      ocr: ocr.status === 'fulfilled' ? ocr.value : null,
      objects: objects.status === 'fulfilled' ? objects.value : null,
      classification: classification.status === 'fulfilled' ? classification.value : null,
      totalTimeMs: Math.round(performance.now() - overallStart),
    };
  }
}

export default VisionService.getInstance();
