import { logger } from '../utils/logger';

export type WhisperModelId = 'Xenova/whisper-tiny.en' | 'Xenova/whisper-base.en';

export type WhisperStatus = 'unloaded' | 'loading' | 'ready' | 'error';

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

  get status() { return this._status; }
  get modelId() { return this._modelId; }
  get isReady() { return this._status === 'ready' && this.transcriber !== null; }

  async loadModel(modelId: WhisperModelId = 'Xenova/whisper-tiny.en'): Promise<void> {
    if (this.isReady && this._modelId === modelId) return;
    if (this._loading) return;

    this._loading = true;
    this._modelId = modelId;
    this._status = 'loading';

    try {
      const mod = await import('@huggingface/transformers');
      this.transcriber = await mod.pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
      } as never) as typeof this.transcriber;

      this._status = 'ready';
      logger.log(`[Whisper] Loaded ${modelId}`);
    } catch (err) {
      this._status = 'error';
      logger.error('[Whisper] Failed to load model:', err);
      throw err;
    } finally {
      this._loading = false;
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

  async unload(): Promise<void> {
    this.transcriber = null;
    this._status = 'unloaded';
  }
}

export default WhisperService.getInstance();
