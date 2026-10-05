import { WebPlugin } from '@capacitor/core';
import type { GIAWakeWordPlugin, WakeWordKeyword, WakeWordStatus } from './GIAWakeWord';

const UNSUPPORTED = 'On-device wake word is only available in the Android app';

/**
 * Browser/PWA stand-in. Nothing listens in the background here, so every
 * call reports "not running" instead of pretending to work.
 */
export class GIAWakeWordWeb extends WebPlugin implements GIAWakeWordPlugin {
  async startListening(): Promise<void> {
    throw this.unavailable(UNSUPPORTED);
  }

  async stopListening(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}

  async isListening(): Promise<{ listening: boolean }> {
    return { listening: false };
  }

  async getStatus(): Promise<WakeWordStatus> {
    return {
      running: false,
      paused: false,
      keyword: '',
      threshold: 0,
      lastScore: 0,
      error: UNSUPPORTED,
      micPermission: false,
    };
  }

  async listKeywords(): Promise<{ keywords: WakeWordKeyword[] }> {
    return { keywords: [] };
  }

  async getPendingWakeWord(): Promise<{ detected: boolean; keyword: string }> {
    return { detected: false, keyword: '' };
  }
}
