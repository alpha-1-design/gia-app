import type { GIAOverlayPlugin } from './GIAOverlay';

export class GIAOverlayWeb implements GIAOverlayPlugin {
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  async startOverlay(): Promise<void> {
    throw new Error('Circle to Search is not available in web browser. Use the GIA Android app.');
  }

  async hideOverlay(): Promise<void> {
    // no-op on web
  }

  async isOverlayVisible(): Promise<{ visible: boolean }> {
    return { visible: false };
  }

  async addListener(
    eventName: string,
    handler: (data: unknown) => void,
  ): Promise<{ remove: () => void }> {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(handler);
    return {
      remove: () => {
        const arr = this.listeners.get(eventName);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx !== -1) arr.splice(idx, 1);
        }
      },
    };
  }

  async removeAllListeners(): Promise<void> {
    this.listeners.clear();
  }
}
