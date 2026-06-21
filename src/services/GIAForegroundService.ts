import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { logger } from '../utils/logger';

export interface GIACorePlugin {
  startCoreService(options?: { startWakeWord?: boolean; accessKey?: string; keyword?: string; sensitivity?: number; customModelPath?: string }): Promise<void>;
  stopCoreService(): Promise<void>;
  getStatus(): Promise<{ running: boolean; online: boolean; networkType: string; metered: boolean; wakeLockHeld: boolean }>;
  getNetworkState(): Promise<{ online: boolean; type: string; metered: boolean }>;
  setKeepAlive(options: { enable: boolean }): Promise<{ keepAlive: boolean }>;
  getKeepAlive(): Promise<{ keepAlive: boolean; running: boolean }>;
  requestBatteryOptimizationExemption(): Promise<void>;
  addListener(eventName: 'networkChanged' | 'keepAliveChanged', handler: (data: Record<string, unknown>) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIACore = registerPlugin<GIACorePlugin>('GIACore', {
  web: () => import('./GIAForegroundService.web').then(m => m.GIAForegroundServiceWeb),
});

class GIAForegroundService {
  private started = false;
  private keepAlive = false;

  async start(keepAlive = true): Promise<void> {
    if (this.started) return;
    try {
      await GIACore.startCoreService({ startWakeWord: false });
      this.started = true;
      if (keepAlive) {
        await this.enableKeepAlive();
      }
      logger.log('[GIAForegroundService] Started');
    } catch (e) {
      logger.warn('[GIAForegroundService] Start failed:', e);
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.keepAlive) {
        await this.disableKeepAlive();
      }
      await GIACore.stopCoreService();
      this.started = false;
      logger.log('[GIAForegroundService] Stopped');
    } catch (e) {
      logger.warn('[GIAForegroundService] Stop failed:', e);
    }
  }

  async enableKeepAlive(): Promise<void> {
    try {
      const res = await GIACore.setKeepAlive({ enable: true });
      this.keepAlive = res.keepAlive;
      logger.log('[GIAForegroundService] Keep-alive enabled');
    } catch (e) {
      logger.warn('[GIAForegroundService] Enable keep-alive failed:', e);
    }
  }

  async disableKeepAlive(): Promise<void> {
    try {
      await GIACore.setKeepAlive({ enable: false });
      this.keepAlive = false;
      logger.log('[GIAForegroundService] Keep-alive disabled');
    } catch (e) {
      logger.warn('[GIAForegroundService] Disable keep-alive failed:', e);
    }
  }

  async getStatus(): Promise<{ running: boolean; keepAlive: boolean }> {
    try {
      const status = await GIACore.getKeepAlive();
      return { running: status.running, keepAlive: this.keepAlive };
    } catch {
      return { running: false, keepAlive: false };
    }
  }

  async requestBatteryExemption(): Promise<void> {
    try {
      await GIACore.requestBatteryOptimizationExemption();
    } catch (e) {
      logger.warn('[GIAForegroundService] Battery exemption failed:', e);
    }
  }

  addNetworkListener(handler: (state: { online: boolean; type: string; metered: boolean }) => void): Promise<PluginListenerHandle> {
    return GIACore.addListener('networkChanged', handler);
  }

  addKeepAliveListener(handler: (state: { keepAlive: boolean }) => void): Promise<PluginListenerHandle> {
    return GIACore.addListener('keepAliveChanged', handler);
  }

  isRunning(): boolean {
    return this.started;
  }

  isKeepAlive(): boolean {
    return this.keepAlive;
  }
}

export default new GIAForegroundService();
