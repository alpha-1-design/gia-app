import type { GIAIntentPlugin } from './GIAIntent';
import type { PluginListenerHandle } from '@capacitor/core';

export class GIAIntentWeb implements GIAIntentPlugin {
  async getPendingIntent(): Promise<{ action?: string; hasData?: boolean; text?: string; mimeType?: string; uri?: string }> {
    return {};
  }

  async clearIntent(): Promise<void> {}

  async addListener(eventName: 'onAssist', handler: (data: { source: string; type: string }) => void): Promise<PluginListenerHandle>;
  async addListener(eventName: 'onDeepLink', handler: (data: { type: string; uri: string; scheme: string; host: string; path: string; query: string }) => void): Promise<PluginListenerHandle>;
  async addListener(eventName: 'onShareReceived', handler: (data: { type: string; mimeType: string; text?: string; subject?: string; imageUri?: string }) => void): Promise<PluginListenerHandle>;
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }

  async removeAllListeners(): Promise<void> {}
}