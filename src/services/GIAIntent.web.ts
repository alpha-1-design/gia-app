import type { GIAIntentPlugin } from './GIAIntent';
import type { PluginListenerHandle } from '@capacitor/core';

export class GIAIntentWeb implements GIAIntentPlugin {
  async getPendingIntent(): Promise<{ action?: string; hasData?: boolean; text?: string; mimeType?: string; uri?: string }> {
    return {};
  }

  async clearIntent(): Promise<void> {}

  async addListener(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _eventName: 'onAssist' | 'onDeepLink' | 'onShareReceived',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _handler: (data: unknown) => void
  ): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }

  async removeAllListeners(): Promise<void> {}
}
