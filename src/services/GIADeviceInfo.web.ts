import type { NativeDeviceInfo } from './GIADeviceInfo';

/**
 * Web fallback for GIADeviceInfo. The browser genuinely cannot see
 * physical RAM (navigator.deviceMemory is Chrome-only and often absent),
 * so this returns zeros for the native-only fields rather than guessing —
 * the caller falls back to its own conservative estimates and marks the
 * result as unmeasured.
 */
export const GIADeviceInfoWeb = {
  async getDeviceInfo(): Promise<NativeDeviceInfo> {
    const nav = navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
    return {
      totalRAM: 0,
      availableRAM: 0,
      lowMemory: false,
      isLowRamDevice: false,
      storageFree: 0,
      storageTotal: 0,
      externalStorageFree: 0,
      cpuCores: nav.hardwareConcurrency || 0,
      model: 'web',
      manufacturer: 'web',
      device: 'web',
      androidVersion: '',
      apiLevel: 0,
    };
  },
};
