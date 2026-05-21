import { CapacitorHttp } from '@capacitor/core';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

class SearchService {
  private static instance: SearchService;
  static getInstance() { if (!this.instance) this.instance = new SearchService(); return this.instance; }

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      const res = await CapacitorHttp.get({
        url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        connectTimeout: 10000,
        readTimeout: 10000,
      });

      if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return this.parseResults(html);
    } catch {
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)}`;
        const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10000) : undefined;
        const res = await fetch(proxyUrl, { signal: timeoutSignal });
        const html = await res.text();
        return this.parseResults(html);
      } catch {
        return [];
      }
    }
  }

  private parseResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seen = new Set<string>();

    const addResult = (el: Element) => {
      const link = el.tagName === 'A' ? el : el.querySelector('a[href]');
      if (!link) return;
      let url = link.getAttribute('href') || '';
      const title = link.textContent?.trim() || '';
      if (!title || !url || seen.has(title)) return;
      // Skip navigation/utility links
      if (url.startsWith('#') || url.startsWith('/')) return;
      if (url.startsWith('//')) url = 'https:' + url;
      const snippet = el.querySelector('.snippet, .result__snippet, .result-snippet, .kHJ7Cb, .VwiC3b, .lEBKkf, span')?.textContent?.trim() || '';
      seen.add(title);
      results.push({ title, url, snippet });
    };

    // Strategy 1: DuckDuckGo HTML results (classic)
    const articles = doc.querySelectorAll('article[data-testid="result"]');
    if (articles.length > 0) {
      articles.forEach(addResult);
      return results.slice(0, 7);
    }

    // Strategy 2: Modern DDG result links
    const resultLinks = doc.querySelectorAll('a.result__a, .result-link, .results_links a');
    resultLinks.forEach(addResult);

    if (results.length === 0) {
      // Strategy 3: Generic link + snippet patterns
      doc.querySelectorAll('.result, .web-result, .results_links_deep, .nrn, .web-result-item').forEach(addResult);
    }

    if (results.length === 0) {
      // Strategy 4: Fallback — any reasonable external link with text
      doc.querySelectorAll('a[href^="http"]').forEach((link) => {
        const text = link.textContent?.trim();
        if (text && text.length > 10 && !seen.has(text)) {
          const parent = link.parentElement;
          const snippet = parent?.textContent?.replace(text, '').trim()?.slice(0, 200) || '';
          seen.add(text);
          results.push({ title: text.slice(0, 100), url: link.getAttribute('href') || '', snippet });
        }
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
