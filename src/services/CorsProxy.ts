import { logger } from '../utils/logger';

const PROXY_LIST = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy/?url=',
  'https://cors-anywhere.gia.workers.dev/?url=',
];

export class CorsProxy {
  private customProxy: string | null = null;

  setProxy = (url: string | null) => {
    this.customProxy = url;
  }

  getActiveProxy = (): string | null => {
    return this.customProxy || null;
  }

  fetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Try direct first
    try {
      const res = await fetch(url, {
        ...options,
        mode: 'cors',
        credentials: 'omit',
      });
      if (res.ok || res.status < 500) {
        return res;
      }
    } catch (e) {
      logger.debug('[CorsProxy] Direct fetch failed:', e instanceof Error ? e.message : e);
    }

    // Try custom proxy if configured
    if (this.customProxy) {
      try {
        const proxyUrl = this.customProxy + encodeURIComponent(url);
        const res = await fetch(proxyUrl, options);
        if (res.ok) {
          logger.log('[CorsProxy] Used custom proxy for:', url.slice(0, 80));
          return res;
        }
      } catch (e) { logger.warn('[CorsProxy] Custom proxy unavailable:', e instanceof Error ? e.message : e); }
    }

    // Public proxies support GET requests; corsproxy.io and the project's own
    // worker (cors-anywhere.gia.workers.dev) forward request headers, so
    // authenticated GETs (e.g. `GET /models` with an Authorization header) can
    // pass through too. Each proxy is only accepted when res.ok — proxies that
    // strip auth headers just fail and we move on to the next.
    const isGet = !options.method || options.method.toUpperCase() === 'GET';

    if (isGet) {
      for (const proxy of PROXY_LIST) {
        try {
          const proxyUrl = proxy + encodeURIComponent(url);
          const res = await fetch(proxyUrl, options);
          if (res.ok) {
            logger.log('[CorsProxy] Used proxy:', proxy);
            return res;
          }
        } catch (e) { logger.debug('[CorsProxy] Public proxy unavailable:', e instanceof Error ? e.message : e); }
      }
    }

    throw new Error(`Failed to fetch ${url.slice(0, 60)} — ${isGet ? 'all proxies exhausted' : 'direct connection failed'}`);
  }

  proxyUrl = (url: string): string => {
    if (this.customProxy) {
      return this.customProxy + encodeURIComponent(url);
    }
    return PROXY_LIST[0] + encodeURIComponent(url);
  }

  fetchJSON = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const res = await this.fetch(url, options);
    return res.json();
  }
}

export const corsProxy = new CorsProxy();
