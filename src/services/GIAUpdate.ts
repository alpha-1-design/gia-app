import { registerPlugin } from '@capacitor/core';

export interface GIAUpdatePlugin {
  installApk(options: { fileName: string }): Promise<void>;
  downloadAndInstall(options: { url: string }): Promise<{ installed: boolean; path: string }>;
}

const GIAUpdate = registerPlugin<GIAUpdatePlugin>('GIAUpdate', {
  web: () => import('./GIAUpdate.web').then(m => m.GIAUpdateWeb),
});

export { GIAUpdate };
