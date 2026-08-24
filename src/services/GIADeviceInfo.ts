import { registerPlugin } from '@capacitor/core';

export interface NativeDeviceInfo {
  /** Physical total RAM, bytes (0 if unknown). */
  totalRAM: number;
  /** Available RAM right now, bytes (0 if unknown). */
  availableRAM: number;
  /** Low-memory flag from ActivityManager. */
  lowMemory: boolean;
  /** ActivityManager low-RAM device classification. */
  isLowRamDevice: boolean;
  /** Free bytes in app storage. */
  storageFree: number;
  /** Total bytes in app storage. */
  storageTotal: number;
  /** Free bytes in external/shared storage (may be 0). */
  externalStorageFree: number;
  /** Logical CPU core count. */
  cpuCores: number;
  model: string;
  manufacturer: string;
  device: string;
  androidVersion: string;
  apiLevel: number;
}

export interface GIADeviceInfoPluginShape {
  getDeviceInfo(): Promise<NativeDeviceInfo>;
}

const GIADeviceInfo = registerPlugin<GIADeviceInfoPluginShape>('GIADeviceInfo', {
  web: () => import('./GIADeviceInfo.web').then((m) => m.GIADeviceInfoWeb),
});

export { GIADeviceInfo };
