import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface DownloadProgressEvent {
  status: 'downloading' | 'downloaded';
  loaded?: number;
  total?: number;
  percent: number;
  size?: number;
}

export interface GIAUpdatePlugin {
  /** Download only — does not install. Emits 'downloadProgress' events as it goes. */
  downloadApk(options: { url: string }): Promise<{ path: string; size: number }>;
  /** Trigger the Android package installer for a previously-downloaded APK. */
  installApk(options?: { fileName?: string }): Promise<{ installed: boolean; path: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIAUpdate = registerPlugin<GIAUpdatePlugin>('GIAUpdate', {
  web: () => import('./GIAUpdate.web').then(m => m.GIAUpdateWeb),
});

export { GIAUpdate };
