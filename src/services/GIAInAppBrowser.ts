import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BrowserResult } from './BrowserRunner';
import { useGiaStore } from '../store/useGiaStore';

interface BrowserPage {
  url: string;
  title: string;
  text: string;
}

interface NativeBrowserPlugin {
  show(): Promise<void>;
  open(options: { url: string }): Promise<BrowserPage>;
  navigate(options: { url: string }): Promise<BrowserPage>;
  readPage(): Promise<BrowserPage>;
  click(options: { selector: string; waitMs?: number }): Promise<BrowserPage>;
  fill(options: { selector: string; value: string; submit?: boolean }): Promise<BrowserPage>;
  scroll(options: { direction: 'down' | 'up' | 'top' | 'bottom'; amount?: number }): Promise<BrowserPage>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  close(): Promise<void>;
}

const NativeBrowser = registerPlugin<NativeBrowserPlugin>('GIAInAppBrowser');

function validateUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only HTTP and HTTPS URLs without embedded credentials are allowed.');
  }
  return url.href;
}

class GIAInAppBrowser {
  private readonly native = Capacitor.isNativePlatform();

  async open(): Promise<void> {
    useGiaStore.getState().setInAppBrowserState({ open: true, mode: 'reader', error: '', loading: false });
    if (this.native) await NativeBrowser.show();
  }

  async openPreview(rawUrl: string): Promise<void> {
    const url = validateUrl(rawUrl);
    useGiaStore.getState().setInAppBrowserState({
      open: true, mode: 'preview', url, title: 'Build preview', content: '', error: '', loading: false,
    });
    if (this.native) await NativeBrowser.open({ url });
  }

  async navigate(rawUrl: string): Promise<BrowserResult> {
    const url = validateUrl(rawUrl);
    useGiaStore.getState().setInAppBrowserState({
      open: true, mode: 'reader', url, title: '', content: '', error: '', loading: true,
    });
    try {
      let page: BrowserResult;
      if (this.native) {
        page = await NativeBrowser.navigate({ url });
      } else {
        try {
          page = await (await import('./BrowserRunner')).default.navigate(url);
        } catch {
          const fallback = (await import('./FallbackWebSearch')).default;
          try {
            const scraped = await fallback.scrape(url, 50000);
            page = { url: scraped.url, title: scraped.title, text: scraped.content };
          } catch (fallbackError) {
            const detail = fallbackError instanceof Error ? fallbackError.message : 'No reader service succeeded.';
            throw new Error(`This site blocks direct browser reading, and the fallback reader could not retrieve it: ${detail}`);
          }
        }
      }
      useGiaStore.getState().setInAppBrowserState({
        url: page.url, title: page.title, content: page.text, error: '', loading: false,
      });
      return page;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser navigation failed';
      useGiaStore.getState().setInAppBrowserState({ error: message, loading: false });
      throw error;
    }
  }

  async readPage(): Promise<BrowserResult> {
    if (!this.native) {
      const url = useGiaStore.getState().inAppBrowser.url;
      if (!url) throw new Error('Navigate to a page before reading it.');
      return this.navigate(url);
    }
    const page = await NativeBrowser.readPage();
    useGiaStore.getState().setInAppBrowserState({
      open: true, mode: 'reader', url: page.url, title: page.title, content: page.text, error: '', loading: false,
    });
    return page;
  }

  async click(selector: string, waitMs = 500): Promise<BrowserResult> {
    return this.runNativeAction(() => NativeBrowser.click({ selector, waitMs }));
  }

  async fill(selector: string, value: string, submit: boolean): Promise<BrowserResult> {
    return this.runNativeAction(() => NativeBrowser.fill({ selector, value, submit }));
  }

  async scroll(direction: 'down' | 'up' | 'top' | 'bottom', amount: number): Promise<BrowserResult> {
    return this.runNativeAction(() => NativeBrowser.scroll({ direction, amount }));
  }

  private async runNativeAction(action: () => Promise<BrowserPage>): Promise<BrowserResult> {
    if (!this.native) {
      throw new Error('Page interaction is available in the Android in-app browser. The web browser is read-only.');
    }
    useGiaStore.getState().setInAppBrowserState({ loading: true, error: '' });
    try {
      const page = await action();
      useGiaStore.getState().setInAppBrowserState({
        open: true, mode: 'reader', url: page.url, title: page.title, content: page.text, error: '', loading: false,
      });
      return page;
    } catch (error) {
      useGiaStore.getState().setInAppBrowserState({
        loading: false,
        error: error instanceof Error ? error.message : 'Browser interaction failed',
      });
      throw error;
    }
  }

  async back(): Promise<void> {
    if (this.native) await NativeBrowser.back();
  }

  async forward(): Promise<void> {
    if (this.native) await NativeBrowser.forward();
  }

  async reload(): Promise<void> {
    if (this.native) {
      await NativeBrowser.reload();
      return;
    }
    const url = useGiaStore.getState().inAppBrowser.url;
    if (url) await this.navigate(url);
  }

  async close(): Promise<void> {
    if (this.native) await NativeBrowser.close();
    useGiaStore.getState().setInAppBrowserState({ open: false });
  }
}

export default new GIAInAppBrowser();
