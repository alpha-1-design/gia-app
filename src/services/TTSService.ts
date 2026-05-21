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

  async speak(text: string, isStreaming: boolean = false) {
    if (!this.enabled) return;
    const cleanText = cleanTTS(text);
    if (!cleanText || cleanText.length < 2) return;

    if (isNative) {
      try {
        await TextToSpeech.speak({ text: cleanText, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
      } catch (e) { console.error('TTS native error:', e); }
    } else {
      try {
        if (!isStreaming) window.speechSynthesis?.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        this.currentUtterance = utterance;
        window.speechSynthesis?.speak(utterance);
      } catch (e) { console.error('TTS web error:', e); }
    }
  }

  async stop() {
    if (isNative) {
      try { await TextToSpeech.stop(); } catch {}
    } else {
      window.speechSynthesis?.cancel();
      this.currentUtterance = null;
    }
  }
}

export default TTSService.getInstance();
