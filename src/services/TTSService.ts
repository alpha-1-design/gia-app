import { TextToSpeech } from '@capacitor-community/text-to-speech';

class TTSService {
  private static instance: TTSService;
  static getInstance() { if (!this.instance) this.instance = new TTSService(); return this.instance; }

  private enabled: boolean = localStorage.getItem('gia-tts-enabled') === 'true';

  setEnabled(v: boolean) {
    this.enabled = v;
    localStorage.setItem('gia-tts-enabled', String(v));
  }

  isEnabled() { return this.enabled; }

  async speak(text: string) {
    if (!this.enabled) return;
    try {
      // Clean markdown for better speech
      const cleanText = text
        .replace(/\[GIA:.*?\]/g, '')
        .replace(/```[\s\S]*?```/g, 'Code block omitted.')
        .replace(/[*_#~`]/g, '')
        .trim();
        
      if (!cleanText) return;

      await TextToSpeech.speak({
        text: cleanText,
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      });
    } catch (e) {
      console.error('TTS error:', e);
    }
  }

  async stop() {
    try {
      await TextToSpeech.stop();
    } catch {}
  }
}

export default TTSService.getInstance();
