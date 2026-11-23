import { logger } from '../utils/logger';

const PROXY_LIST = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy/?url=',
  'https://cors-anywhere.gia.workers.dev/?url=',
];

/**
 * Headers that must never be forwarded to a PUBLIC third-party proxy.
 * Public CORS proxies see (and commonly log) every request header — sending
 * an Authorization / x-api-key through one would leak the user's provider
 * credentials to a third party. A user-configured custom proxy is exempt:
 * the user pointed GIA at infrastructure they trust.
 */
const CREDENTIAL_HEADERS = [
  'authorization',
  'x-api-key',
  'x-goog-api-key',
  'api-key',
  'cookie',
];

/** Opt-in custom proxy so users who need the fallback can still have one. */
const CUSTOM_PROXY_KEY = 'gia-cors-proxy';

function readCustomProxy(): string | null {
  try {
    return localStorage.getItem(CUSTOM_PROXY_KEY) || null;
  } catch {
    return null;
  }
}

export class CorsProxy {
  private customProxy: string | null = null;

  constructor() {
    this.customProxy = readCustomProxy();
  }

  setProxy = (url: string | null) => {
    this.customProxy = url;
    try {
      if (url) localStorage.setItem(CUSTOM_PROXY_KEY, url);
      else localStorage.removeItem(CUSTOM_PROXY_KEY);
    } catch { /* storage unavailable — in-memory only */ }
  }

  getActiveProxy = (): string | null => {
    return this.customProxy || null;
  }

  /** Strip credential headers (returns a shallow copy; never mutates input). */
  private static sanitizeHeaders(options: RequestInit): RequestInit {
    if (!options.headers) return options;
    const headers = new Headers(options.headers as HeadersInit);
    for (const h of CREDENTIAL_HEADERS) headers.delete(h);
    return { ...options, headers };
  }

  /** True when the target URL itself embeds a credential (e.g. Gemini `?key=`). */
  private static urlHasCredential(url: string): boolean {
    try {
      const u = new URL(url);
      for (const [name] of u.searchParams) {
        if (name.toLowerCase() === 'key' || name.toLowerCase().endsWith('_key') || name.toLowerCase() === 'apikey') return true;
      }
    } catch { /* not a parseable URL — treat as non-credential */ }
    return false;
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

    // Custom proxy if configured (user opted into this infrastructure —
    // headers and bodies pass through as-is).
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

    // Public proxies are GET-only relays that see every header and the full
    // target URL. Credentialed requests (auth headers, `?key=` query params)
    // and non-GET requests with bodies must never touch them.
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const hasBodyCredential = !!options.headers && (() => {
      const h = new Headers(options.headers as HeadersInit);
      return CREDENTIAL_HEADERS.some(name => h.has(name));
    })();

    if (isGet) {
      const credentialled = hasBodyCredential || CorsProxy.urlHasCredential(url);
      if (credentialled) {
        logger.warn('[CorsProxy] Refusing to route credentialed request through public proxies');
      } else {
        const safeOptions = CorsProxy.sanitizeHeaders(options);
        for (const proxy of PROXY_LIST) {
          try {
            const proxyUrl = proxy + encodeURIComponent(url);
            const res = await fetch(proxyUrl, safeOptions);
            if (res.ok) {
              logger.log('[CorsProxy] Used proxy:', proxy);
              return res;
            }
          } catch (e) { logger.debug('[CorsProxy] Public proxy unavailable:', e instanceof Error ? e.message : e); }
        }
      }
    }

    throw new Error(`Failed to fetch ${url.slice(0, 60)} — ${isGet ? 'all proxies exhausted' : 'direct connection failed'}`);
  }

  /**
   * Build a proxied URL for a request the caller performs itself.
   *
   * Returns the user-configured custom proxy when set; otherwise THROWS.
   * The previous behaviour — silently falling back to a public third-party
   * proxy — sent `Authorization`/`x-api-key` headers and the full chat
   * transcript (POST body) to services like corsproxy.io, and for Gemini the
   * API key sits in the proxied URL itself. Providers already set the correct
   * direct-browser CORS headers (Anthropic: `anthropic-dangerous-direct-
   * browser-access`, Gemini/OpenAI: native CORS), so the direct attempt is
   * the right path; a credential-bearing retry through a stranger's server
   * is never an acceptable fallback. Users who genuinely need a proxy can
   * set one explicitly (setProxy / `gia-cors-proxy` in localStorage).
   */
  proxyUrl = (url: string): string => {
    if (this.customProxy) {
      return this.customProxy + encodeURIComponent(url);
    }
    throw new Error(
      'Direct request failed and no custom CORS proxy is configured. '
      + 'Check the endpoint URL / network, or set a trusted CORS proxy in Settings → Developer.',
    );
  }

  fetchJSON = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const res = await this.fetch(url, options);
    return res.json();
  }
}

export const corsProxy = new CorsProxy();
