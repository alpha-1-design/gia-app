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

class TTSService {
  private static instance: TTSService;
  static getInstance() { if (!this.instance) this.instance = new TTSService(); return this.instance; }

  private enabled: boolean = localStorage.getItem('gia-tts-enabled') === 'true';
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  setEnabled(v: boolean) {
    this.enabled = v;
    localStorage.setItem('gia-tts-enabled', String(v));
  }

  isEnabled() { return this.enabled; }

  private streamBuffer = '';
  private streamTimer: ReturnType<typeof setTimeout> | null = null;

  async speak(text: string, isStreaming: boolean = false) {
    if (!this.enabled) return;
    const cleanText = cleanTTS(text);
    if (!cleanText || cleanText.length < 2) return;

    if (isNative) {
      try {
        await TextToSpeech.speak({ text: cleanText, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
      } catch (e) { logger.error('TTS native error:', e); }
    } else {
      try {
        if (!isStreaming) {
          window.speechSynthesis?.cancel();
          this.streamBuffer = '';
          if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null; }
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.lang = 'en-US';
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          this.currentUtterance = utterance;
          window.speechSynthesis?.speak(utterance);
        } else {
          // Buffer streaming chunks and flush on sentence boundary or timeout
          this.streamBuffer += cleanText;
          if (this.streamTimer) clearTimeout(this.streamTimer);
          const sentenceMatch = this.streamBuffer.match(/.*?[.!?\n]+/);
          if (sentenceMatch && sentenceMatch[0].length > 20) {
            const toSpeak = sentenceMatch[0];
            this.streamBuffer = this.streamBuffer.slice(toSpeak.length);
            const utterance = new SpeechSynthesisUtterance(toSpeak);
            utterance.lang = 'en-US';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis?.speak(utterance);
          }
          // Flush remaining buffer after 2s of silence
          this.streamTimer = setTimeout(() => {
            if (this.streamBuffer) {
              const utterance = new SpeechSynthesisUtterance(this.streamBuffer);
              utterance.lang = 'en-US';
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              utterance.volume = 1.0;
              window.speechSynthesis?.speak(utterance);
              this.streamBuffer = '';
            }
          }, 2000);
        }
      } catch (e) { logger.error('TTS web error:', e); }
    }
  }

  async stop() {
    if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null; }
    this.streamBuffer = '';
    if (isNative) {
      try { await TextToSpeech.stop(); } catch (e) { logger.error('[TTSService] Failed to stop TTS:', e); }
    } else {
      window.speechSynthesis?.cancel();
      this.currentUtterance = null;
    }
  }
}

export default TTSService.getInstance();
