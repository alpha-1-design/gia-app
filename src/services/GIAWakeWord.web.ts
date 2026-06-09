import type { GIAWakeWordPlugin } from './GIAWakeWord';
import type { PluginListenerHandle } from '@capacitor/core';

export class GIAWakeWordWeb implements GIAWakeWordPlugin {
  async startListening(): Promise<void> {
    console.warn('[GIAWakeWord] Native wake word not available on web');
  }

  async stopListening(): Promise<void> {
  }

  async isListening(): Promise<{ listening: boolean }> {
    return { listening: false };
  }

  async getPendingWakeWord(): Promise<{ detected: boolean; keyword: string }> {
    return { detected: false, keyword: '' };
  }

  async addListener(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _eventName: 'wakeWordDetected',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _handler: (result: { keyword: string }) => void
  ): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }

  async removeAllListeners(): Promise<void> {
  }
}
