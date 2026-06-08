import { logger } from '../utils/logger';

export interface BrowserResult {
  text: string;
  title: string;
  url: string;
  screenshot?: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(ms: number): Promise<void> {
  const jitter = Math.random() * 200;
  return new Promise(r => setTimeout(r, ms + jitter));
}

function stealthHeaders(): Record<string, string> {
  return {
    'User-Agent': pickUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

function rewriteHTML(html: string, baseUrl: string): string {
  const baseTag = `<base href="${baseUrl}">`;
  let result = html.replace('<head>', `<head>${baseTag}`);
  if (!result.includes('<head>')) {
    result = result.replace('<html', '<html><head>').replace('</html>', '</html>');
    result = result.replace('<head>', `<head>${baseTag}`);
  }
  return result;
}

function extractMainContent(doc: Document): string {
  const article = doc.querySelector('article');
  if (article) return article.innerText;
  const main = doc.querySelector('main');
  if (main) return main.innerText;
  const body = doc.body;
  if (!body) return '';
  body.querySelectorAll('script, style, nav, footer, header, aside, .sidebar, .nav, .footer, .header, .menu, .advertisement, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach(el => {
    el.remove();
  });
  const text = body.innerText || '';
  return text.trim().slice(0, 50000);
}

class BrowserRunner {
  private iframe: HTMLIFrameElement | null = null;
  private pendingResolve: ((result: BrowserResult) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private proxyUrl = '';
  private initialized = false;
  private cookieStore: Record<string, string> = {};

  private init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const saved = localStorage.getItem('gia-browser-proxy');
      if (saved) this.proxyUrl = saved;
    } catch (e) { logger.error('[BrowserRunner] localStorage not available:', e); }
  }

  setProxy(url: string) { this.proxyUrl = url; }
  getProxy() { this.init(); return this.proxyUrl; }

  private cleanup() {
    if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  async navigate(
    url: string,
    onProgress?: (status: string) => void,
    signal?: AbortSignal,
  ): Promise<BrowserResult> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const effectiveUrl = this.proxyUrl
      ? `${this.proxyUrl.replace(/\/$/, '')}/${encodeURIComponent(url)}`
      : url;

    onProgress?.('Preparing request…');
    await randomDelay(300);

    onProgress?.('Fetching page…');
    const headers: Record<string, string> = {
      ...stealthHeaders(),
    };
    const domain = new URL(url).hostname;
    if (this.cookieStore[domain]) {
      headers['Cookie'] = this.cookieStore[domain];
    }

    const res = await fetch(effectiveUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!res.ok) {
      if (res.status === 403) throw new Error(`Blocked (403) — ${domain} may be protected by Cloudflare or similar. Try a CORS proxy.`);
      if (res.status === 429) throw new Error(`Rate limited (429) — ${domain} is throttling requests.`);
      if (res.status === 0) throw new Error('CORS blocked. Configure a CORS proxy in Settings → Browser Automation.');
      throw new Error(`HTTP ${res.status} from ${domain}`);
    }

    // Capture Set-Cookie headers
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/^([^=]+)=([^;]+)/);
      if (match) {
        this.cookieStore[domain] = `${match[1]}=${match[2]}`;
      }
    }

    onProgress?.('Reading response…');
    await randomDelay(200);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      const text = await res.text();
      return { text: text.slice(0, 25000), title: '', url };
    }

    const html = await res.text();
    const rewritten = rewriteHTML(html, url);

    onProgress?.('Rendering page…');
    const result = await new Promise<BrowserResult>((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox.add('allow-scripts');
      document.body.appendChild(iframe);
      this.iframe = iframe;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        setTimeout(() => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!doc) throw new Error('Failed to access iframe document');
            const title = doc.title || '';
            onProgress?.('Extracting content…');
            const text = extractMainContent(doc);
            const result: BrowserResult = { text: text.slice(0, 50000), title, url };
            iframe.remove();
            this.iframe = null;
            resolve(result);
          } catch (err) {
            iframe.remove();
            this.iframe = null;
            reject(err instanceof Error ? err : new Error('Extraction failed'));
          }
        }, 500);
      };

      this.timeoutId = setTimeout(finish, 8000);
      iframe.onload = finish;
      iframe.srcdoc = rewritten;
    });

    return result;
  }

  clearCookies() {
    this.cookieStore = {};
  }

  abort() {
    this.cleanup();
  }
}

export default new BrowserRunner();
