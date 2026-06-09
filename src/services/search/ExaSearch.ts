export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface ExaSearchOptions {
  numResults?: number;
  type?: 'keyword' | 'neural' | 'auto';
  includeDomains?: string[];
  excludeDomains?: string[];
}

class ExaSearch {
  private baseUrl = 'https://api.exa.ai';

  async search(query: string, apiKey: string, options: ExaSearchOptions = {}): Promise<SearchResult[]> {
    const { numResults = 7, type = 'auto', includeDomains, excludeDomains } = options;

    const body: Record<string, unknown> = {
      query,
      numResults,
      type,
      contents: {
        text: true,
        highlights: { highlightsPerUrl: 1, numSentences: 2, query },
      },
    };

    if (includeDomains?.length) body.includeDomains = includeDomains;
    if (excludeDomains?.length) body.excludeDomains = excludeDomains;

    const res = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Exa Search returned ${res.status}: ${errText}`);
    }

    const data = await res.json();

    if (!data.results?.length) return [];

    return data.results.map((r: { title?: string; url: string; text?: string; highlights?: string[] }) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.text || r.highlights?.[0] || '',
      source: 'exa',
    }));
  }

  async fetchContents(url: string, apiKey: string): Promise<{ title: string; content: string }> {
    const res = await fetch(`${this.baseUrl}/contents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        urls: [url],
        text: { maxCharacters: 25000, includeHtmlTags: false },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Exa Contents returned ${res.status}`);

    const data = await res.json();
    const result = data.results?.[0];
    return {
      title: result?.title || url,
      content: result?.text || '',
    };
  }
}

export const exaSearch = new ExaSearch();
