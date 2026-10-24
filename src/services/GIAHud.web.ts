import type { PluginListenerHandle } from '@capacitor/core';
import type { GIAHudPlugin } from './GIAHud';

/**
 * Web fallback. The floating HUD is an in-app component on web; the native
 * overlay only exists on Android. Keeping these methods as no-ops means the
 * shared hook can call them without branching everywhere.
 */
export class GIAHudWeb implements GIAHudPlugin {
  async start(): Promise<void> {
    throw new Error('The floating HUD overlay is only available in the GIA Android app.');
  }

  async show(): Promise<void> {
    throw new Error('The floating HUD overlay is only available in the GIA Android app.');
  }

  async hide(): Promise<void> {}

  async stop(): Promise<void> {}

  async isVisible(): Promise<{ visible: boolean }> {
    return { visible: false };
  }

  async appendMessage(): Promise<void> {}

  async streamDelta(): Promise<void> {}

  async setBusy(): Promise<void> {}

  async clearMessages(): Promise<void> {}

  addListener(
    eventName: 'hudMessage',
    handler: (event: { text: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'hudClosed',
    handler: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    _eventName: 'hudMessage' | 'hudClosed',
    _handler: ((event: { text: string }) => void) | (() => void),
  ): Promise<PluginListenerHandle> {
    void _eventName;
    void _handler;
    return Promise.resolve({ remove: () => Promise.resolve() });
  }

  async removeAllListeners(): Promise<void> {}
}
