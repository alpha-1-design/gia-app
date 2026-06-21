import type { PluginListenerHandle } from '@capacitor/core';

/** Web fallback for GIACore plugin — no-ops for browser environment */
export class GIAForegroundServiceWeb {
  async startCoreService(): Promise<void> {}
  async stopCoreService(): Promise<void> {}
  async getStatus(): Promise<{ running: boolean; online: boolean; networkType: string; metered: boolean; wakeLockHeld: boolean }> {
    return { running: false, online: navigator.onLine, networkType: 'unknown', metered: false, wakeLockHeld: false };
  }
  async getNetworkState(): Promise<{ online: boolean; type: string; metered: boolean }> {
    return { online: navigator.onLine, type: 'unknown', metered: false };
  }
  async setKeepAlive(): Promise<{ keepAlive: boolean }> {
    return { keepAlive: false };
  }
  async getKeepAlive(): Promise<{ keepAlive: boolean; running: boolean }> {
    return { keepAlive: false, running: false };
  }
  async requestBatteryOptimizationExemption(): Promise<void> {}
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }
  async removeAllListeners(): Promise<void> {}
}
