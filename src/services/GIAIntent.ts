import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface GIAIntentPlugin {
  getPendingIntent(): Promise<{ action?: string; hasData?: boolean; text?: string; mimeType?: string; uri?: string }>;
  clearIntent(): Promise<void>;
  addListener(eventName: 'onAssist', handler: (data: { source: string; type: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onDeepLink', handler: (data: { type: string; uri: string; scheme: string; host: string; path: string; query: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onShareReceived', handler: (data: { type: string; mimeType: string; text?: string; subject?: string; imageUri?: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIAIntent = registerPlugin<GIAIntentPlugin>('GIAIntent', {
  web: () => import('./GIAIntent.web').then(m => m.GIAIntentWeb),
});

export { GIAIntent };
