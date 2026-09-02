import type { GIAUpdatePlugin } from './GIAUpdate';

export class GIAUpdateWeb implements GIAUpdatePlugin {
  async installApk(): Promise<void> {
    throw new Error('APK install is only available on Android');
  }

  async downloadAndInstall(): Promise<{ installed: boolean; path: string }> {
    throw new Error('APK download is only available on Android');
  }
}
