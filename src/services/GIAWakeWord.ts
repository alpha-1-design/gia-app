import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface GIAWakeWordPlugin {
  startListening(options?: {
    accessKey?: string;
    keyword?: string;
    sensitivity?: number;
    customModelPath?: string;
  }): Promise<void>;

  stopListening(): Promise<void>;

  isListening(): Promise<{ listening: boolean }>;

  getPendingWakeWord(): Promise<{ detected: boolean; keyword: string }>;

  addListener(
    eventName: 'wakeWordDetected',
    handler: (result: { keyword: string }) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

const GIAWakeWord = registerPlugin<GIAWakeWordPlugin>('GIAWakeWord', {
  web: () => import('./GIAWakeWord.web').then(m => m.GIAWakeWordWeb),
});

export { GIAWakeWord };
