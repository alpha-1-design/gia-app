import { logger } from '../utils/logger';

export interface BrowserResult {
  text: string;
  title: string;
  url: string;
  screenshot?: string;
}

function randomDelay(ms: number): Promise<void> {
  const jitter = Math.random() * 200;
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

function extractText(element: Element | null): string {
  if (!element) return '';
  const htmlElement = element as HTMLElement;
  return (htmlElement.innerText || element.textContent || '').trim();
}

function extractMainContent(doc: Document): string {
  const article = doc.querySelector('article');
  if (article) return extractText(article);
  const main = doc.querySelector('main');
  if (main) return extractText(main);
  const body = doc.body;
  if (!body) return '';
  body.querySelectorAll('script, style, nav, footer, header, aside, .sidebar, .nav, .footer, .header, .menu, .advertisement, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach(element => {
    element.remove();
  });
  return extractText(body).slice(0, 50000);
}

class BrowserRunner {
  private proxyUrl = '';
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const saved = localStorage.getItem('gia-browser-proxy');
      if (saved) this.proxyUrl = saved;
    } catch (error) {
      logger.error('[BrowserRunner] localStorage not available:', error);
    }
  }

  setProxy(url: string) {
    this.proxyUrl = url;
  }

  getProxy() {
    this.init();
    return this.proxyUrl;
  }

  async navigate(
    url: string,
    onProgress?: (status: string) => void,
    signal?: AbortSignal,
  ): Promise<BrowserResult> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    this.init();

    const effectiveUrl = this.proxyUrl
      ? `${this.proxyUrl.replace(/\/$/, '')}/${encodeURIComponent(url)}`
      : url;

    onProgress?.('Preparing request…');
    await randomDelay(300);

    onProgress?.('Fetching page…');
    const domain = new URL(url).hostname;

    const response = await fetch(effectiveUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
      credentials: 'omit',
    });

    if (!response.ok) {
      if (response.status === 403) throw new Error(`Blocked (403) — ${domain} may be protected by Cloudflare or similar. Try a CORS proxy.`);
      if (response.status === 429) throw new Error(`Rate limited (429) — ${domain} is throttling requests.`);
      if (response.status === 0) throw new Error('CORS blocked. Configure a CORS proxy in Settings → Browser Automation.');
      throw new Error(`HTTP ${response.status} from ${domain}`);
    }

    onProgress?.('Reading response…');
    await randomDelay(200);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      const text = await response.text();
      return { text: text.slice(0, 25000), title: '', url };
    }

    const html = await response.text();
    onProgress?.('Extracting content…');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      text: extractMainContent(doc).slice(0, 50000),
      title: doc.title || '',
      url,
    };
  }
}

export default new BrowserRunner();
