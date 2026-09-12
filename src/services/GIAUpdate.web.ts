import { WebPlugin } from '@capacitor/core';
import type { GIAUpdatePlugin } from './GIAUpdate';

// Extends WebPlugin (not just `implements`) so addListener/removeAllListeners
// have real event-emitter behavior instead of throwing if ever called on web.
export class GIAUpdateWeb extends WebPlugin implements GIAUpdatePlugin {
  async downloadApk(): Promise<{ path: string; size: number }> {
    throw new Error('APK download is only available on Android');
  }

  async installApk(): Promise<{ installed: boolean; path: string }> {
    throw new Error('APK install is only available on Android');
  }
}
