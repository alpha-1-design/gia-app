import type { GIAUpdatePlugin } from './GIAUpdate';

export class GIAUpdateWeb implements GIAUpdatePlugin {
  async installApk(): Promise<void> {
    throw new Error('APK install is only available on Android');
  }
}
