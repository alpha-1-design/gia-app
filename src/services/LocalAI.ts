import { logger } from '../utils/logger';

export interface LocalClassificationResult {
  label: string;
  score: number;
}

export interface LocalSummarizationResult {
  text: string;
  model: string;
  timeMs: number;
}

export interface LocalTranslationResult {
  text: string;
  sourceLang: string;
  targetLang: string;
  timeMs: number;
}

export interface LocalEmbeddingResult {
  embedding: number[];
  model: string;
  timeMs: number;
}

export interface LocalQAResult {
  answer: string;
  score: number;
  model: string;
  timeMs: number;
}

type PipelineFn = (...args: unknown[]) => Promise<unknown>;
type PipelineTask = 'text-classification' | 'summarization' | 'translation' | 'feature-extraction' | 'question-answering' | 'zero-shot-classification';

class LocalAI {
  private static instance: LocalAI;

  private pipelines: Map<string, { pipeline: PipelineFn; modelId: string }> = new Map();
  private loading: Map<string, boolean> = new Map();

  static getInstance() {
    if (!this.instance) this.instance = new LocalAI();
    return this.instance;
  }

  private async getPipeline(task: PipelineTask, modelId: string): Promise<PipelineFn> {
    const key = `${task}:${modelId}`;
    const existing = this.pipelines.get(key);
    if (existing) return existing.pipeline;

    if (this.loading.get(key)) {
      await new Promise<void>(resolve => {
        const check = () => {
          if (this.pipelines.has(key)) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
      return this.pipelines.get(key)!.pipeline;
    }

    this.loading.set(key, true);
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const pipe = await pipeline(task, modelId);
      this.pipelines.set(key, { pipeline: pipe as PipelineFn, modelId });
      logger.log(`[LocalAI] Loaded ${task} model: ${modelId}`);
      return pipe as PipelineFn;
    } finally {
      this.loading.set(key, false);
    }
  }

  isLoaded(task: string, modelId: string): boolean {
    return this.pipelines.has(`${task}:${modelId}`);
  }

  async classify(text: string, labels: string[], modelId = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'): Promise<LocalClassificationResult[]> {
    const pipe = await this.getPipeline('text-classification', modelId);
    const result = await pipe(text, { topk: labels.length }) as { label: string; score: number }[];
    return result.map(r => ({ label: r.label, score: r.score }));
  }

  async summarize(text: string, modelId = 'Xenova/distilbart-cnn-6-6'): Promise<LocalSummarizationResult> {
    const start = performance.now();
    if (text.length < 100) return { text, model: modelId, timeMs: 0 };
    const pipe = await this.getPipeline('summarization', modelId);
    const result = await pipe(text, { max_length: Math.min(200, Math.round(text.length / 2)), min_length: 30 }) as { summary_text: string }[];
    return {
      text: result?.[0]?.summary_text || text,
      model: modelId,
      timeMs: Math.round(performance.now() - start),
    };
  }

  async translate(text: string, targetLang: string, sourceLang = 'auto', modelId = 'Xenova/m2m100_418M'): Promise<LocalTranslationResult> {
    const start = performance.now();
    const pipe = await this.getPipeline('translation', modelId);
    const result = await pipe(text, { src_lang: sourceLang, tgt_lang: targetLang }) as { translation_text: string }[];
    return {
      text: result?.[0]?.translation_text || text,
      sourceLang,
      targetLang,
      timeMs: Math.round(performance.now() - start),
    };
  }

  async embed(text: string, modelId = 'Xenova/all-MiniLM-L6-v2'): Promise<LocalEmbeddingResult> {
    const start = performance.now();
    const pipe = await this.getPipeline('feature-extraction', modelId);
    const result = await pipe(text, { pooling: 'mean', normalize: true }) as { data: number[]; dims: number[] } | number[][];
    let embedding: number[];
    if (Array.isArray(result) && Array.isArray(result[0])) {
      embedding = result[0] as number[];
    } else {
      embedding = (result as { data: number[]; dims: number[] }).data || [];
    }
    return {
      embedding,
      model: modelId,
      timeMs: Math.round(performance.now() - start),
    };
  }

  async answer(question: string, context: string, modelId = 'Xenova/distilbert-base-uncased-distilled-squad'): Promise<LocalQAResult> {
    const start = performance.now();
    const pipe = await this.getPipeline('question-answering', modelId);
    const result = await pipe(question, context) as { answer: string; score: number }[];
    return {
      answer: result?.[0]?.answer || '',
      score: result?.[0]?.score || 0,
      model: modelId,
      timeMs: Math.round(performance.now() - start),
    };
  }

  async zeroShot(text: string, labels: string[], modelId = 'Xenova/nli-deberta-v3-xsmall'): Promise<LocalClassificationResult[]> {
    const pipe = await this.getPipeline('zero-shot-classification', modelId);
    const result = await pipe(text, labels) as { labels: string[]; scores: number[] };
    return result.labels.map((label, i) => ({ label, score: result.scores[i] }));
  }
}

export default LocalAI.getInstance();
