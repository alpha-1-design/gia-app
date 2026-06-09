import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface GIAOverlayPlugin {
  startOverlay(): Promise<void>;

  hideOverlay(): Promise<void>;

  isOverlayVisible(): Promise<{ visible: boolean }>;

  addListener(
    eventName: 'overlayResult',
    handler: (result: { dataUrl?: string; text?: string; cancelled?: boolean }) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

const GIAOverlay = registerPlugin<GIAOverlayPlugin>('GIAOverlay', {
  web: () => import('./GIAOverlay.web').then(m => m.GIAOverlayWeb),
});

export { GIAOverlay };
