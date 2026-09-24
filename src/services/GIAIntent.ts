import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

/**
 * Operational state of the Termux bridge.
 *
 * `installed` only means the Termux package is present. `ready` is the one that
 * matters: it is true only when Termux actually services RUN_COMMAND, which
 * requires `allow-external-apps = true` in ~/.termux/termux.properties.
 */
export interface TermuxStatus {
  installed: boolean;
  ready: boolean;
  /** Whether a live round-trip probe completed. */
  bridgeResponsive: boolean;
  /** Effective value of allow-external-apps (probe result OR declared value). */
  allowExternalApps: boolean;
  /** Raw termux.properties value; null when the file is unreadable from GIA. */
  declaredAllowExternalApps: boolean | null;
  reason: string;
  hint: string;
}

export interface GIAIntentPlugin {
  getPendingIntent(): Promise<{ action?: string; hasData?: boolean; text?: string; mimeType?: string; uri?: string; widgetAction?: string }>;
  clearIntent(): Promise<void>;
  termuxStatus(): Promise<TermuxStatus>;
  openTermux(): Promise<void>;
  runTermuxCommand(options: { command: string; args?: string[]; workdir?: string }): Promise<{ jobId: string; stdout?: string; stderr?: string; exitCode?: number }>;
  addListener(eventName: 'onAssist', handler: (data: { source: string; type: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onDeepLink', handler: (data: { type: string; uri: string; scheme: string; host: string; path: string; query: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onShareReceived', handler: (data: { type: string; mimeType: string; text?: string; subject?: string; imageUri?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'onWidgetAction', handler: (data: { action: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIAIntent = registerPlugin<GIAIntentPlugin>('GIAIntent', {
  web: () => import('./GIAIntent.web').then(m => m.GIAIntentWeb),
});

export { GIAIntent };
