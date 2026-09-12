import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface ScreenElement {
  type: string;
  text: string;
  className: string;
  contentDescription?: string;
  clickable: boolean;
  longClickable: boolean;
  focusable: boolean;
  editable: boolean;
  scrollable: boolean;
  depth: number;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
}

export interface ScreenCaptureResult {
  screenshotPath?: string;
  text: string;
  elementCount: number;
  elements: ScreenElement[];
  timestamp: number;
}

export interface ScreenAgentPlugin {
  capture(): Promise<ScreenCaptureResult>;
  getScreenContent(): Promise<ScreenCaptureResult>;
  getAccessibilityTree(): Promise<{ tree: string; timestamp: number }>;
  performTap(options: { x: number; y: number }): Promise<void>;
  tapText(options: { text: string }): Promise<{ clicked: boolean; foundOn: string; bounds: ScreenElement['bounds'] }>;
  startWatching(options?: { intervalMs?: number }): Promise<void>;
  stopWatching(): Promise<void>;

  /** Show the floating GIA orb overlay */
  showOrb(): Promise<void>;
  /** Hide the floating GIA orb overlay */
  hideOrb(): Promise<void>;
  /** Get orb status */
  isOrbShowing(): Promise<{ showing: boolean; size: number }>;
  /** Set orb size in dp */
  setOrbSize(options: { size: number }): Promise<void>;

  /**
   * Orb Assistant bridge — stream a response delta/final into the orb's HUD.
   * Called by OrbAssistant while GIA processes a capture in the background.
   */
  orbResponse(options: { delta: string; done: boolean; final?: string }): Promise<void>;
  /** Toggle native orb speech (Android TextToSpeech). */
  setOrbSpeech(options: { enabled: boolean }): Promise<void>;
  /** Show an image (screen capture) in the orb HUD so GIA can send pictures. */
  orbShowImage(options: { path: string }): Promise<void>;
  /** Scroll/swipe the current screen (up/down/left/right). */
  performSwipe(options: { direction: 'up' | 'down' | 'left' | 'right' }): Promise<{ ok: boolean }>;
  /** Launch an app by package name or launcher label. */
  openApp(options: { app: string }): Promise<{ ok: boolean }>;
  /** Send the system BACK action. */
  goBack(): Promise<{ ok: boolean }>;

  addListener(eventName: string, handler: (result: Record<string, unknown>) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const GIAScreenAgent = registerPlugin<ScreenAgentPlugin>('GIAScreenAgent', {
  web: () => import('./GIAScreenAgent.web').then(m => m.GIAScreenAgentWeb),
});

export { GIAScreenAgent };
