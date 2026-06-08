import { logger } from '../utils/logger';
import { CapacitorHttp } from '@capacitor/core';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  image?: string;
}

class SearchService {
  private static instance: SearchService;
  private cache = new Map<string, { results: SearchResult[]; ts: number }>();
  private cacheTTL = 120_000;
  private proxyList = [
    (q: string) => `https://corsproxy.io/?${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)}`,
    (q: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)}`,
    (q: string) => `https://api.corsfix.com/proxy?url=${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`)}`,
    (q: string) => `https://cors-anywhere.herokuapp.com/https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    (q: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(q)}&sourceid=chrome&ie=UTF-8`)}`,
  ];
  static getInstance() { if (!this.instance) this.instance = new SearchService(); return this.instance; }

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.results;

    // Strategy A: direct via Capacitor (native)
    if (typeof CapacitorHttp !== 'undefined') {
      try {
        const res = await CapacitorHttp.get({
          url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          connectTimeout: 10000,
          readTimeout: 10000,
        });
        if (res.status >= 200 && res.status < 300) {
          const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          return this.parseResults(html);
        }
      } catch (e) { logger.error('[SearchService] Strategy A (axios) failed:', e); }
    }

    // Strategy B: try CORS proxies in order
    for (const buildUrl of this.proxyList) {
      try {
        const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10000) : undefined;
        const res = await fetch(buildUrl(query), { signal: timeoutSignal });
        if (!res.ok) continue;
        const html = await res.text();
        if (html.length < 200) continue; // empty/error page
        const parsed = this.parseResults(html);
        if (parsed.length > 0) {
          this.cache.set(query, { results: parsed, ts: Date.now() });
          return parsed;
        }
      } catch (e) { logger.error('[SearchService] Proxy fetch failed, trying next:', e); }
    }

    return [];
  }

  private resolveUrl(raw: string): string {
    if (!raw) return '';
    if (raw.startsWith('//')) return 'https:' + raw;
    // DuckDuckGo redirect URLs
    const uddgMatch = raw.match(/uddg=([^&]+)/);
    if (uddgMatch) return decodeURIComponent(uddgMatch[1]);
    const ruMatch = raw.match(/ru=([^&]+)/);
    if (ruMatch) return decodeURIComponent(ruMatch[1]);
    return raw;
  }

  private parseResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seen = new Set<string>();

    const extractUrl = (el: Element): string | null => {
      const a = el.tagName === 'A' ? el : el.querySelector('a[href]');
      if (!a) return null;
      const raw = a.getAttribute('href') || '';
      const resolved = this.resolveUrl(raw);
      if (!resolved || resolved.startsWith('#') || resolved.startsWith('/') || resolved === 'https://example.com' || resolved.includes('duckduckgo.com')) return null;
      return resolved;
    };

    const addResult = (el: Element) => {
      const url = extractUrl(el);
      if (!url) return;
      const link = el.tagName === 'A' ? el : el.querySelector('a[href]');
      const title = link?.textContent?.trim() || '';
      if (!title || title.length < 5 || seen.has(title)) return;
      const snippet = el.querySelector('.snippet, .result__snippet, .result-snippet, .kHJ7Cb, .VwiC3b, .lEBKkf, span')?.textContent?.trim()
        || el.querySelector('.result-snippet')?.textContent?.trim()
        || '';
      seen.add(title);
      results.push({ title, url, snippet });
    };

    // Strategy 1: DuckDuckGo HTML results (main content)
    const articles = doc.querySelectorAll('article[data-testid="result"]');
    if (articles.length > 0) {
      articles.forEach(addResult);
      return results.slice(0, 7);
    }

    // Strategy 2: Result links with heading class
    doc.querySelectorAll('a[data-testid="result-title-a"], .result__a, .result-link, .results_links a, h2 a').forEach(addResult);

    if (results.length === 0) {
      // Strategy 3: Generic result containers
      doc.querySelectorAll('.result, .web-result, .results_links_deep, .nrn, .web-result-item, .result-body').forEach(addResult);
    }

    if (results.length === 0) {
      // Strategy 4: All external links with meaningful text, filter aggressively
      doc.querySelectorAll('a[href^="http"]').forEach((link) => {
        const url = this.resolveUrl(link.getAttribute('href') || '');
        if (!url || url.includes('duckduckgo.com') || url === 'https://example.com' || url.startsWith('https://www.google')) return;
        const text = link.textContent?.trim();
        if (!text || text.length < 15 || seen.has(text) || text.includes('Privacy') || text.includes('Settings')) return;
        const parent = link.parentElement;
        const snippet = parent?.textContent?.replace(text, '').trim()?.slice(0, 200) || '';
        seen.add(text);
        results.push({ title: text.slice(0, 100), url, snippet });
      });
    }

    return results.slice(0, 7);
  }

  async searchAndFormat(query: string): Promise<string> {
    const results = await this.search(query);
    if (results.length === 0) return '';

    const formatted = results.map((r, i) =>
      `[${i + 1}] [${r.title}](${r.url})\n    > ${r.snippet}`
    ).join('\n');

    return `## Web Search: "${query}"\n\n${formatted}\n\n*(Cite sources as [1], [2], etc. when using this information.)*`;
  }

  async searchWithSources(query: string): Promise<{ content: string; sources: { title: string; url: string }[] }> {
    const results = await this.search(query);
    if (results.length === 0) return { content: '', sources: [] };

    const content = results.map((r, i) =>
      `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`
    ).join('\n\n');

    return {
      content: `WEB SEARCH RESULTS for "${query}":\n\n${content}\n\nUse these results to inform your response. Cite sources using [1], [2], etc.`,
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  }
}

export default SearchService.getInstance();
