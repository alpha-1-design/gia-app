import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface GIAHudPlugin {
  start(): Promise<void>;
  show(): Promise<void>;
  hide(): Promise<void>;
  stop(): Promise<void>;
  isVisible(): Promise<{ visible: boolean }>;
  appendMessage(options: { role: 'user' | 'assistant'; text: string }): Promise<void>;
  streamDelta(options: { delta: string; done: boolean; finalText?: string }): Promise<void>;
  setBusy(options: { busy: boolean }): Promise<void>;
  clearMessages(): Promise<void>;
  addListener(
    eventName: 'hudMessage',
    handler: (event: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'hudClosed',
    handler: () => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIAHud = registerPlugin<GIAHudPlugin>('GIAHud', {
  web: () => import('./GIAHud.web').then(m => new m.GIAHudWeb()),
});

export { GIAHud };
