import type { PluginListenerHandle } from '@capacitor/core';
import type { ScreenAgentPlugin, ScreenCaptureResult, ScreenElement } from './GIAScreenAgent';
import { screenAgent } from './ScreenAgent';

type ListenerMap = Map<string, Array<(result: Record<string, unknown>) => void>>;

export class GIAScreenAgentWeb implements ScreenAgentPlugin {
  private listeners: ListenerMap = new Map();

  async capture(): Promise<ScreenCaptureResult> {
    const content = await screenAgent.captureAndAnalyze();
    if (!content) {
      return { text: '', elementCount: 0, elements: [], timestamp: Date.now() };
    }
    return {
      text: content.text,
      elementCount: content.elements.length,
      elements: content.elements.map(e => ({
        type: e.type,
        text: e.text,
        className: '',
        clickable: e.type === 'button',
        longClickable: false,
        focusable: e.type === 'input',
        editable: e.type === 'input',
        scrollable: false,
        depth: 0,
        bounds: {
          left: e.bounds.x,
          top: e.bounds.y,
          right: e.bounds.x + e.bounds.width,
          bottom: e.bounds.y + e.bounds.height,
          width: e.bounds.width,
          height: e.bounds.height,
          centerX: e.bounds.x + e.bounds.width / 2,
          centerY: e.bounds.y + e.bounds.height / 2,
        },
      })),
      timestamp: Date.now(),
    };
  }

  async getScreenContent(): Promise<ScreenCaptureResult> {
    return this.capture();
  }

  async getAccessibilityTree(): Promise<{ tree: string; timestamp: number }> {
    return { tree: '{}', timestamp: Date.now() };
  }

  async performTap(options: { x: number; y: number }): Promise<void> {
    const el = document.elementFromPoint(options.x, options.y) as HTMLElement | null;
    if (el) {
      el.click();
    }
  }

  async tapText(options: { text: string }): Promise<{ clicked: boolean; foundOn: string; bounds: ScreenElement['bounds'] }> {
    const buttons = document.querySelectorAll('button, a, [role="button"], [tabindex]');
    const lower = options.text.toLowerCase();

    for (const btn of buttons) {
      if (btn.textContent?.toLowerCase().includes(lower)) {
        (btn as HTMLElement).click();
        const rect = btn.getBoundingClientRect();
        return {
          clicked: true,
          foundOn: document.location.hostname || 'web',
          bounds: {
            left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
            width: rect.width, height: rect.height, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2,
          },
        };
      }
    }

    return { clicked: false, foundOn: 'web', bounds: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 } };
  }

  async startWatching(options?: { intervalMs?: number }): Promise<void> {
    screenAgent.startWatching(options?.intervalMs || 3000);
    screenAgent.onScreenChange((content) => {
      const handlers = this.listeners.get('screenChanged') || [];
      handlers.forEach(h => h({ text: content.text.slice(0, 1000), timestamp: Date.now() }));
    });
    this.notifyListeners('watchingStarted');
  }

  async stopWatching(): Promise<void> {
    screenAgent.stopWatching();
  }

  async showOrb(): Promise<void> {
    // No floating overlay on web — throw so the UI reports the real reason
    // instead of silently pretending the orb is active.
    throw new Error('Screen Orb overlay is only available on Android');
  }
  async hideOrb(): Promise<void> {
    // Nothing to hide on web (the orb never shows).
  }
  async isOrbShowing(): Promise<{ showing: boolean; size: number }> {
    return { showing: false, size: 56 };
  }
  async setOrbSize(): Promise<void> {
    // Web: no floating overlay support
  }

  addListener(eventName: string, handler: (result: Record<string, unknown>) => void): Promise<PluginListenerHandle> {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(handler);
    return Promise.resolve({
      remove: () => {
        const arr = this.listeners.get(eventName);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx !== -1) arr.splice(idx, 1);
        }
        return Promise.resolve();
      },
    });
  }

  async removeAllListeners(): Promise<void> {
    this.listeners.clear();
  }

  private notifyListeners(eventName: string, result: Record<string, unknown> = {}): void {
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.forEach(h => h(result));
    }
  }
}
