import { logger } from '../utils/logger';
import { validateAndDeduplicateSources } from '../utils/sourceValidator';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  source: string;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
];

const UA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

function withTimeout(ms: number, parent?: AbortController): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  if (parent) {
    parent.signal.addEventListener('abort', () => {
      clearTimeout(id);
      ctrl.abort();
    }, { once: true });
  }
  return ctrl.signal;
}

const CORS_PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.corsfix.com/proxy?url=${encodeURIComponent(u)}`,
];

function extractGoogleResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const patterns = [
    /<a\s+href=["']\/url\?q=([^"']+)["'][^>]*>(.*?)<\/a>/gi,
    /<a\s+href=["']https?:\/\/([^"']+)["'][^>]*>(.*?)<\/a>/gi,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const url = m[1].replace(/&amp;/g, '&');
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (!title || title.length < 5 || seen.has(title)) continue;
      if (url.includes('google.com') || url.includes('accounts.google')) continue;
      const cleanUrl = url.split('&')[0];
      seen.add(title);
      let snippet = '';
      const afterMatch = html.slice(m.index + m[0].length, m.index + m[0].length + 500);
      const snip = afterMatch.match(/<div[^>]*style=["']-webkit-line-clamp["'][^>]*>([\s\S]*?)<\/div>/i);
      if (snip) snippet = snip[1].replace(/<[^>]+>/g, '').trim();
      results.push({ title, url: cleanUrl, snippet: snippet.slice(0, 200), source: 'google' });
    }
  }
  return results.slice(0, 7);
}

function extractBingResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const items = html.match(/<li\s+class=["']b_algo["'][\s\S]*?<\/li>/gi) || [];
  for (const item of items) {
    const titleMatch = item.match(/<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/i);
    if (!titleMatch) continue;
    const url = titleMatch[1];
    const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    const snippetMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    results.push({ title, url, snippet: snippet.slice(0, 200), source: 'bing' });
  }
  return results.slice(0, 7);
}

function extractDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const articles = html.match(/<article[^>]*data-testid=["']result["'][\s\S]*?<\/article>/gi) || [];
  for (const article of articles) {
    const aMatch = article.match(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/i);
    if (!aMatch) continue;
    let url = aMatch[1];
    if (!url.startsWith('http')) {
      const uddg = url.match(/uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      else continue;
    }
    const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 5 || seen.has(title)) continue;
    seen.add(title);
    const snippetMatch = article.match(/<span[^>]*class=["'][^"']*snippet[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    results.push({ title, url, snippet: snippet.slice(0, 200), source: 'duckduckgo' });
  }
  return results.slice(0, 7);
}

class FallbackWebSearch {
  private static instance: FallbackWebSearch;
  private searchCache = new Map<string, { results: SearchResult[]; ts: number }>();
  private scrapeCache = new Map<string, { result: ScrapeResult; ts: number }>();
  private cacheTTL = 180_000;

  static getInstance() {
    if (!this.instance) this.instance = new FallbackWebSearch();
    return this.instance;
  }

  async search(query: string, maxResults = 7): Promise<SearchResult[]> {
    const cached = this.searchCache.get(query);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.results;

    // Global search timeout: 30s max for any search
    const globalAbort = new AbortController();
    const globalTimeout = setTimeout(() => globalAbort.abort(new Error('Global search timeout')), 30000);

    try {
      // Try the configured search provider first (Exa, Browserless, etc.)
      try {
        const { default: searchRouter } = await import('./SearchRouter');
        const providerResults = await searchRouter.search(query);
        if (providerResults.length > 0) {
          const sanitized = providerResults.map(r => ({ ...r, title: sanitizeTitle(r.title) }));
          const final = sanitized.slice(0, maxResults);
          this.searchCache.set(query, { results: final, ts: Date.now() });
          return final;
        }
      } catch {
        // Fall through to scraping strategies
      }

      if (globalAbort.signal.aborted) return [];

      const allResults: SearchResult[] = [];
      const strategies = [
        () => this.searchDuckDuckGo(query, globalAbort),
        () => this.searchGoogle(query, globalAbort),
        () => this.searchBing(query, globalAbort),
        () => this.searchWikipedia(query, globalAbort),
      ];

      for (const strategy of strategies) {
        if (allResults.length >= maxResults) break;
        if (globalAbort.signal.aborted) break;
        try {
          const results = await strategy();
          for (const r of results) {
            if (!allResults.find(x => x.url === r.url)) {
              allResults.push(r);
            }
          }
        } catch (e) {
          logger.warn('[FallbackWebSearch] Strategy failed:', e);
        }
      }

    const validated = validateAndDeduplicateSources(allResults, maxResults);
    const final = validated.map(v => ({
      title: sanitizeTitle(v.title ?? ''),
      url: v.url,
      snippet: v.snippet || v.snippet?.slice(0, 200) || '',
      source: v.source || 'web',
    }));
    this.searchCache.set(query, { results: final, ts: Date.now() });
    return final;
    } finally {
      clearTimeout(globalTimeout);
    }
  }

  private async searchDuckDuckGo(query: string, parentAbort?: AbortController): Promise<SearchResult[]> {
    try {
      const { default: searchService } = await import('./SearchService');
      const results = await searchService.search(query);
      return results.map(r => ({ ...r, source: 'duckduckgo' }));
    } catch {
      const urls = [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        ...CORS_PROXIES.map(fn => fn(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)),
      ];
      for (const url of urls) {
        try {
          if (parentAbort?.signal.aborted) return [];
          const res = await fetch(url, { headers: { 'User-Agent': UA() }, signal: withTimeout(8000, parentAbort) });
          if (!res.ok) continue;
          const html = await res.text();
          const results = extractDuckDuckGoResults(html);
          if (results.length > 0) return results;
        } catch { continue; }
      }
      return [];
    }
  }

  private async searchGoogle(query: string, parentAbort?: AbortController): Promise<SearchResult[]> {
    const urls = [
      `https://www.google.com/search?q=${encodeURIComponent(query)}&sourceid=chrome&ie=UTF-8`,
      ...CORS_PROXIES.map(fn => fn(`https://www.google.com/search?q=${encodeURIComponent(query)}&sourceid=chrome&ie=UTF-8`)),
    ];
    for (const url of urls) {
      try {
        if (parentAbort?.signal.aborted) return [];
        const res = await fetch(url, {
          headers: { 'User-Agent': UA(), 'Accept': 'text/html,*/*' },
          signal: withTimeout(8000, parentAbort),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const results = extractGoogleResults(html);
        if (results.length > 0) return results;
      } catch { continue; }
    }
    return [];
  }

  private async searchBing(query: string, parentAbort?: AbortController): Promise<SearchResult[]> {
    const urls = [
      `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      ...CORS_PROXIES.map(fn => fn(`https://www.bing.com/search?q=${encodeURIComponent(query)}`)),
    ];
    for (const url of urls) {
      try {
        if (parentAbort?.signal.aborted) return [];
        const res = await fetch(url, {
          headers: { 'User-Agent': UA(), 'Accept': 'text/html,*/*' },
          signal: withTimeout(8000, parentAbort),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const results = extractBingResults(html);
        if (results.length > 0) return results;
      } catch { continue; }
    }
    return [];
  }

  private async searchWikipedia(query: string, parentAbort?: AbortController): Promise<SearchResult[]> {
    try {
      if (parentAbort?.signal.aborted) return [];
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5`,
        { headers: { 'User-Agent': 'GIA/2.3.1' }, signal: withTimeout(5000, parentAbort) },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const results = (data.query?.search || []).map((s: { title: string; snippet: string; pageid: number }) => ({
        title: s.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
        snippet: s.snippet.replace(/<[^>]+>/g, ''),
        source: 'wikipedia',
      }));
      return results;
    } catch { return []; }
  }

  async scrape(url: string, maxChars = 25000): Promise<ScrapeResult> {
    const cached = this.scrapeCache.get(url);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.result;

    // Global scrape timeout: 45s max
    const globalAbort = new AbortController();
    const globalTimeout = setTimeout(() => globalAbort.abort(new Error('Global scrape timeout')), 45000);

    try {
      // Try configured search provider first (Exa Contents API or Browserless)
      try {
        const { default: searchRouter } = await import('./SearchRouter');
        const providerResult = await searchRouter.fetch(url);
        if (providerResult && providerResult.content.length > 50) {
          this.scrapeCache.set(url, { result: providerResult, ts: Date.now() });
          return providerResult;
        }
      } catch {
        // Fall through to scraping strategies
      }

      if (globalAbort.signal.aborted) throw new Error('Scrape aborted before strategies');

      const strategies = [
        () => this.scrapeViaWebFetch(url, maxChars, globalAbort),
        () => this.scrapeViaJina(url, maxChars, globalAbort),
        () => this.scrapeDirect(url, maxChars, globalAbort),
        () => this.scrapeViaProxy(url, maxChars, globalAbort),
        () => this.scrapeViaScreenshot(url),
      ];

      let lastError = '';
      for (const strategy of strategies) {
        if (globalAbort.signal.aborted) break;
        try {
          const result = await strategy();
          if (result.content.length > 50) {
            const sanitized = await sanitizeResult(result.content, url);
            if (!sanitized.isSafe) {
              logger.warn(`[FallbackWebSearch] Unsafe content from ${url}: ${sanitized.warning}`);
              result.content = sanitized.content +
                '\n\n[⚠️ Safety Notice: The above content was flagged for potential manipulation. Proceed with caution.]';
            } else {
              result.content = sanitized.content;
            }
            this.scrapeCache.set(url, { result, ts: Date.now() });
            return result;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Failed';
        }
      }

      throw new Error(`All scraping strategies failed for ${url}. Last: ${lastError}`);
    } finally {
      clearTimeout(globalTimeout);
    }
  }

  private async scrapeViaWebFetch(url: string, maxChars: number, _parentAbort?: AbortController): Promise<ScrapeResult> {
    void _parentAbort;
    const { default: wf } = await import('./WebFetchService');
    const page = await wf.fetch(url, { format: 'markdown', maxChars });
    return { url, title: page.title, content: page.content, source: 'webfetch' };
  }

  private async scrapeViaJina(url: string, maxChars: number, parentAbort?: AbortController): Promise<ScrapeResult> {
    if (parentAbort?.signal.aborted) throw new Error('Aborted');
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'User-Agent': UA(),
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-With-Generated-Alt': 'true',
      },
      signal: withTimeout(20000, parentAbort),
    });
    if (!res.ok) throw new Error(`Jina returned ${res.status}`);
    const text = await res.text();
    const content = text.replace(/\s+/g, ' ').trim().slice(0, maxChars);
    return { url, title: url, content, source: 'jina' };
  }

  private async scrapeDirect(url: string, maxChars: number, parentAbort?: AbortController): Promise<ScrapeResult> {
    if (parentAbort?.signal.aborted) throw new Error('Aborted');
    const res = await fetch(url, {
      headers: { 'User-Agent': UA(), 'Accept': 'text/html,*/*' },
      signal: withTimeout(10000, parentAbort),
    });
    if (!res.ok) throw new Error(`Direct fetch returned ${res.status}`);
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || url;
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
    return { url, title, content, source: 'direct' };
  }

  private async scrapeViaProxy(url: string, maxChars: number, parentAbort?: AbortController): Promise<ScrapeResult> {
    for (const buildProxy of CORS_PROXIES) {
      try {
        if (parentAbort?.signal.aborted) throw new Error('Aborted');
        const proxyUrl = buildProxy(url);
        const res = await fetch(proxyUrl, {
          headers: { 'User-Agent': UA(), 'Accept': 'text/html,*/*' },
          signal: withTimeout(15000, parentAbort),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || url;
        const main = html.match(/<article[^>]*>[\s\S]*?<\/article>/i)?.[0]
          || html.match(/<main[^>]*>[\s\S]*?<\/main>/i)?.[0]
          || html.match(/<body[^>]*>[\s\S]*?<\/body>/i)?.[0]
          || html;
        const content = main
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, maxChars);
        if (content.length > 100) return { url, title, content, source: 'proxy' };
      } catch { continue; }
    }
    throw new Error('All proxies failed');
  }

  private async scrapeViaScreenshot(url: string): Promise<ScrapeResult> {
    const imgUrl = `https://api.screenshotmachine.com/?key=free&url=${encodeURIComponent(url)}&dimension=1280x720&format=png`;
    return {
      url,
      title: `Screenshot of ${url}`,
      content: `![Screenshot of ${url}](${imgUrl})\n\n*A screenshot was captured since text extraction failed. The image shows the visual rendering of the page at ${url}.*`,
      source: 'screenshot',
    };
  }

  async searchAndFormat(query: string): Promise<string> {
    const results = await this.search(query);
    if (results.length === 0) return '';
    const formatted = results.map((r, i) =>
      `[${i + 1}] [${r.title}](${r.url})  _(via ${r.source})_\n    > ${r.snippet}`
    ).join('\n');
    return `## Web Search: "${query}"\n\n${formatted}\n\n*(Cite sources as [1], [2], etc. when using this information.)*`;
  }

  clearCache(): void {
    this.searchCache.clear();
    this.scrapeCache.clear();
  }
}

// ── Helpers ──────────────────────────────────────────────

async function sanitizeResult(content: string, source: string): Promise<{
  content: string; isSafe: boolean; warning: string;
}> {
  const sanitizer = (await import('./WebContentSanitizer')).default;
  const result = sanitizer.sanitize(content, source);
  return {
    content: result.content,
    isSafe: result.safe,
    warning: sanitizer.summarize(result),
  };
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .trim();
}

export default FallbackWebSearch.getInstance();
