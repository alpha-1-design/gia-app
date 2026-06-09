import type { PluginListenerHandle } from '@capacitor/core';
import type { GIAOverlayPlugin } from './GIAOverlay';

type ListenerMap = Map<string, Array<(data: unknown) => void>>;

export class GIAOverlayWeb implements GIAOverlayPlugin {
  private listeners: ListenerMap = new Map();

  async startOverlay(): Promise<void> {
    throw new Error('Circle to Search is not available in web browser. Use the GIA Android app.');
  }

  async hideOverlay(): Promise<void> {
  }

  async isOverlayVisible(): Promise<{ visible: boolean }> {
    return { visible: false };
  }

  addListener(
    eventName: 'overlayResult',
    handler: (result: { dataUrl?: string; text?: string; cancelled?: boolean }) => void,
  ): Promise<PluginListenerHandle> {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(handler);
    return Promise.resolve({
      remove: () => {
        const arr = this.listeners.get(eventName);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx !== -1) arr.splice(idx, 1);
        }
        return Promise.resolve();
      },
    });
  }

  async removeAllListeners(): Promise<void> {
    this.listeners.clear();
  }
}
