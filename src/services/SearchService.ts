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
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
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

    const rows = doc.querySelectorAll('.result, .web-result, .results_links');
    if (rows.length > 0) {
      rows.forEach((row) => {
        const linkEl = row.querySelector('a[href]');
        const snippetEl = row.querySelector('.snippet, .result__snippet, .result-snippet');
        if (!linkEl) return;
        const title = linkEl.textContent?.trim() || '';
        let url = linkEl.getAttribute('href') || '';
        if (url.startsWith('//')) url = 'https:' + url;
        const snippet = snippetEl?.textContent?.trim() || '';
        if (title && url) results.push({ title, url, snippet });
      });
    }

    const tableResults = doc.querySelectorAll('table tr');
    if (results.length === 0 && tableResults.length > 0) {
      tableResults.forEach((row) => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 3) {
          const link = tds[0].querySelector('a');
          if (link) {
            results.push({
              title: link.textContent?.trim() || '',
              url: link.getAttribute('href') || '',
              snippet: tds[1]?.textContent?.trim() || '',
            });
          }
        }
      });
    }

    const linkResults = doc.querySelectorAll('a.result-link, a.result__a');
    if (results.length === 0) {
      linkResults.forEach((link) => {
        const snippet = link.parentElement?.querySelector('.result__snippet, .snippet')?.textContent?.trim() || '';
        results.push({
          title: link.textContent?.trim() || '',
          url: link.getAttribute('href') || '',
          snippet,
        });
      });
    }

    return results.slice(0, 7);
  }

  async searchAndFormat(query: string): Promise<string> {
    const results = await this.search(query);
    if (results.length === 0) return '';

    const formatted = results.map((r, i) =>
      `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`
    ).join('\n\n');

    return `WEB SEARCH RESULTS for "${query}":\n\n${formatted}\n\nUse these results to inform your response. Cite sources naturally.`;
  }
}

export default SearchService.getInstance();
