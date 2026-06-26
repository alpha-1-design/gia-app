import { logger } from '../utils/logger';

interface ScreenshotResult {
  dataUrl: string;
  timestamp: number;
}

interface ScreenContent {
  text: string;
  elements: ScreenElement[];
  appName: string;
  url?: string;
}

interface ScreenElement {
  type: 'button' | 'input' | 'link' | 'image' | 'text' | 'list' | 'card';
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
  action?: string;
}

export class ScreenAgent {
  private isActive = false;
  private screenshotInterval: ReturnType<typeof setInterval> | null = null;
  private lastScreenText = '';
  private onChangeCallbacks: Array<(content: ScreenContent) => void> = [];

  onScreenChange(callback: (content: ScreenContent) => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  async activate(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    logger.info('[ScreenAgent] Activated');

    try {
      await this.captureAndAnalyze();
    } catch (e) {
      logger.warn('[ScreenAgent] Initial capture failed:', e);
    }
  }

  deactivate(): void {
    this.isActive = false;
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    logger.info('[ScreenAgent] Deactivated');
  }

  startWatching(intervalMs = 5000): void {
    this.activate();
    if (this.screenshotInterval) clearInterval(this.screenshotInterval);
    this.screenshotInterval = setInterval(() => {
      this.captureAndAnalyze().catch(() => {});
    }, intervalMs);
    logger.info(`[ScreenAgent] Watching every ${intervalMs}ms`);
  }

  stopWatching(): void {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    this.deactivate();
  }

  async captureAndAnalyze(): Promise<ScreenContent | null> {
    if (!this.isActive) return null;

    const screenshot = await this.captureScreenshot();
    if (!screenshot) return null;

    const content = await this.analyzeScreen(screenshot);
    if (!content) return null;

    if (content.text !== this.lastScreenText) {
      this.lastScreenText = content.text;
      for (const cb of this.onChangeCallbacks) {
        try { cb(content); } catch (e) { logger.warn('[ScreenAgent] Callback error:', e); }
      }
    }

    return content;
  }

  private async captureScreenshot(): Promise<ScreenshotResult | null> {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = mediaStream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      mediaStream.getTracks().forEach((t) => t.stop());

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.7),
        timestamp: Date.now(),
      };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        logger.info('[ScreenAgent] Screen capture permission denied');
      } else {
        logger.warn('[ScreenAgent] Screenshot failed:', e);
      }
      return null;
    }
  }

  private async analyzeScreen(screenshot: ScreenshotResult): Promise<ScreenContent | null> {
    try {
      const canvas = document.createElement('canvas');
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = screenshot.dataUrl;
      });
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const textContent = await this.extractTextFromCanvas(canvas);
      const elements = this.detectElements();

      return {
        text: textContent,
        elements,
        appName: this.detectApp(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      };
    } catch (e) {
      logger.warn('[ScreenAgent] Analysis failed:', e);
      return null;
    }
  }

  private async extractTextFromCanvas(canvas: HTMLCanvasElement): Promise<string> {
    try {
      const modName = 'tesseract' + '.js';
      const tesseractMod: unknown = await Function(`return import("${modName}")`)();
      const mod = tesseractMod as { createWorker: (lang: string) => Promise<{ recognize: (img: unknown) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> }> };
      const worker = await mod.createWorker('eng');
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      return data.text || '';
    } catch {
      /* fallback below */
    }
    return document.body?.innerText?.slice(0, 5000) || '';
  }

  private detectElements(): ScreenElement[] {
    const elements: ScreenElement[] = [];
    const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
    buttons.forEach((btn) => {
      elements.push({
        type: 'button',
        text: btn.textContent?.trim() || btn.getAttribute('aria-label') || '',
        bounds: btn.getBoundingClientRect(),
      });
    });

    const inputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]');
    inputs.forEach((input) => {
      const el = input as HTMLElement;
      elements.push({
        type: 'input',
        text: el.getAttribute('placeholder') || el.getAttribute('aria-label') || '',
        bounds: el.getBoundingClientRect(),
      });
    });

    const links = document.querySelectorAll('a');
    links.forEach((link) => {
      const el = link as HTMLElement;
      elements.push({
        type: 'link',
        text: el.textContent?.trim() || '',
        bounds: el.getBoundingClientRect(),
      });
    });

    return elements;
  }

  private detectApp(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    if (ua.includes('Electron')) return 'GIA Desktop';
    return 'Web Browser';
  }

  async answerQuestion(question: string): Promise<string> {
    if (!this.isActive) {
      await this.activate();
    }

    const content = await this.captureAndAnalyze();
    if (!content) return 'Could not capture screen content.';

    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('button') || lowerQuestion.includes('click') || lowerQuestion.includes('tap')) {
      const targetText = question.replace(/click |tap |button |"|'/g, '').trim();
      const matchingButton = content.elements.find(
        (e) => e.type === 'button' && e.text.toLowerCase().includes(targetText.toLowerCase())
      );
      if (matchingButton) {
        return `Found button "${matchingButton.text}" at position (${Math.round(matchingButton.bounds.x)}, ${Math.round(matchingButton.bounds.y)}). I can simulate a click on it.`;
      }
    }

    if (lowerQuestion.includes('form') || lowerQuestion.includes('input') || lowerQuestion.includes('field')) {
      const fields = content.elements.filter((e) => e.type === 'input');
      if (fields.length > 0) {
        return `Found ${fields.length} input field(s): ${fields.map((f) => `"${f.text}"`).join(', ')}`;
      }
    }

    return `I can see the screen. Here's what I found:\n\n${content.text.slice(0, 1000)}`;
  }

  async fillForm(fields: Array<{ label: string; value: string }>): Promise<boolean> {
    let success = true;

    for (const { label, value } of fields) {
      const input = this.findInputElement(label);
      if (input) {
        try {
          const el = input as HTMLInputElement;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          nativeInputValueSetter?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
          logger.warn(`[ScreenAgent] Failed to fill field "${label}":`, e);
          success = false;
        }
      } else {
        success = false;
      }
    }

    return success;
  }

  private findInputElement(label: string): HTMLElement | null {
    const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '');

    const inputs = document.querySelectorAll<HTMLElement>(
      'input, textarea, [contenteditable="true"]'
    );

    for (const input of inputs) {
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const name = (input.getAttribute('name') || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (placeholder === normalizedLabel || ariaLabel === normalizedLabel || name === normalizedLabel) {
        return input;
      }
    }

    const labels = document.querySelectorAll('label');
    for (const lbl of labels) {
      const text = (lbl.textContent || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (text === normalizedLabel && lbl.htmlFor) {
        return document.getElementById(lbl.htmlFor);
      }
    }

    return null;
  }

  async extractData(pattern: string): Promise<string[]> {
    const content = await this.captureAndAnalyze();
    if (!content) return [];

    const results: string[] = [];
    const regex = new RegExp(pattern, 'gi');
    let match;

    while ((match = regex.exec(content.text)) !== null) {
      results.push(match[1] || match[0]);
    }

    return [...new Set(results)];
  }

  getStatus(): { isActive: boolean; watching: boolean } {
    return {
      isActive: this.isActive,
      watching: this.screenshotInterval !== null,
    };
  }
}

export const screenAgent = new ScreenAgent();
