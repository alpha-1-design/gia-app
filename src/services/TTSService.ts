import { logger } from '../utils/logger';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNativePlatform } from '../utils/helpers';

const cleanTTS = (text: string) =>
  text
    .replace(/\[GIA:.*?\]/g, '')
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/[*_#~`]/g, '')
    .trim();

const isNative = isNativePlatform();

type SpeakCallback = () => void;

class TTSService {
  private static instance: TTSService;
  static getInstance() { if (!this.instance) this.instance = new TTSService(); return this.instance; }

  private enabled: boolean = localStorage.getItem('gia-tts-enabled') === 'true';
  private queue: string[] = [];
  private speaking = false;
  private onComplete: SpeakCallback | null = null;
  private streamBuffer = '';
  private streamTimer: ReturnType<typeof setTimeout> | null = null;

  setEnabled(v: boolean) {
    this.enabled = v;
    localStorage.setItem('gia-tts-enabled', String(v));
  }

  isEnabled() { return this.enabled; }

  onSpeakComplete(cb: SpeakCallback | null) {
    this.onComplete = cb;
  }

  async speak(text: string, isStreaming: boolean = false) {
    if (!this.enabled) return;
    const cleanText = cleanTTS(text);
    if (!cleanText || cleanText.length < 2) return;

    if (isStreaming) {
      this.streamBuffer += cleanText;
      if (this.streamTimer) clearTimeout(this.streamTimer);
      const sentenceMatch = this.streamBuffer.match(/.*?[.!?\n]+/);
      if (sentenceMatch && sentenceMatch[0].length > 20) {
        const toSpeak = sentenceMatch[0];
        this.streamBuffer = this.streamBuffer.slice(toSpeak.length);
        this.enqueue(toSpeak);
      }
      this.streamTimer = setTimeout(() => {
        if (this.streamBuffer) {
          this.enqueue(this.streamBuffer);
          this.streamBuffer = '';
        }
      }, 2000);
    } else {
      this.enqueue(cleanText);
    }
  }

  private enqueue(text: string) {
    this.queue.push(text);
    if (!this.speaking) this.processQueue();
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.speaking = false;
      this.onComplete?.();
      return;
    }

    this.speaking = true;
    const text = this.queue.shift()!;

    try {
      if (isNative) {
        await TextToSpeech.speak({ text, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
      } else {
        await this.webSpeak(text);
      }
    } catch (e) {
      logger.error('[TTSService] speak error:', e);
    }

    this.processQueue();
  }

  private webSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);

      setTimeout(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
        resolve();
      }, Math.max(3000, text.length * 80));
    });
  }

  async stop() {
    if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null; }
    this.streamBuffer = '';
    this.queue = [];
    this.speaking = false;
    if (isNative) {
      try { await TextToSpeech.stop(); } catch (e) { logger.error('[TTSService] Failed to stop TTS:', e); }
    } else {
      window.speechSynthesis?.cancel();
    }
  }
}

export default TTSService.getInstance();
