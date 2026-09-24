import type { GIAIntentPlugin, TermuxStatus } from './GIAIntent';
import type { PluginListenerHandle } from '@capacitor/core';

export class GIAIntentWeb implements GIAIntentPlugin {
  async getPendingIntent(): Promise<{ action?: string; hasData?: boolean; text?: string; mimeType?: string; uri?: string; widgetAction?: string }> {
    return {};
  }

  async clearIntent(): Promise<void> {}
  async termuxStatus(): Promise<TermuxStatus> {
    return {
      installed: false,
      ready: false,
      bridgeResponsive: false,
      allowExternalApps: false,
      declaredAllowExternalApps: null,
      reason: 'not_native',
      hint: 'Termux integration requires the native Android app.',
    };
  }
  async openTermux(): Promise<void> { throw new Error('Termux integration requires the native Android app'); }
  async runTermuxCommand(): Promise<{ jobId: string; stdout?: string; stderr?: string; exitCode?: number }> { throw new Error('Termux integration requires the native Android app'); }

  async addListener(eventName: 'onAssist', handler: (data: { source: string; type: string }) => void): Promise<PluginListenerHandle>;
  async addListener(eventName: 'onDeepLink', handler: (data: { type: string; uri: string; scheme: string; host: string; path: string; query: string }) => void): Promise<PluginListenerHandle>;
  async addListener(eventName: 'onShareReceived', handler: (data: { type: string; mimeType: string; text?: string; subject?: string; imageUri?: string }) => void): Promise<PluginListenerHandle>;
  async addListener(eventName: 'onWidgetAction', handler: (data: { action: string }) => void): Promise<PluginListenerHandle>;
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }

  async removeAllListeners(): Promise<void> {}
}