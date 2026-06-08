import { logger } from '../utils/logger';

const PROXY_LIST = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.gia.workers.dev/?url=',
];

export class CorsProxy {
  private customProxy: string | null = null;

  setProxy(url: string | null) {
    this.customProxy = url;
  }

  getActiveProxy(): string | null {
    return this.customProxy || null;
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Try direct first
    for (let attempt = 0; attempt < 2; attempt++) {
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
        logger.warn('[CorsProxy] Direct fetch failed, trying proxy:', e);
      }
    }

    // Try custom proxy
    if (this.customProxy) {
      try {
        const proxyUrl = this.customProxy + encodeURIComponent(url);
        const res = await fetch(proxyUrl, options);
        if (res.ok) {
          logger.log('[CorsProxy] Used custom proxy for:', url.slice(0, 80));
          return res;
        }
      } catch (e) { logger.warn('[CorsProxy] Custom proxy unavailable:', e); }
    }

    // Try public proxies
    for (const proxy of PROXY_LIST) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        const res = await fetch(proxyUrl, options);
        if (res.ok) {
          logger.log('[CorsProxy] Used proxy:', proxy);
          return res;
        }
      } catch (e) { logger.warn('[CorsProxy] Public proxy unavailable:', e); }
    }

    throw new Error(`Failed to fetch ${url.slice(0, 60)} — all proxies exhausted`);
  }

  async fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await this.fetch(url, options);
    return res.json();
  }
}

export const corsProxy = new CorsProxy();
