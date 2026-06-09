import { logger } from '../../utils/logger';

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  source: string;
}

class BrowserlessIO {
  private baseUrl = 'https://chrome.browserless.io';

  async scrape(url: string, apiKey: string, options: { maxChars?: number; waitUntil?: string } = {}): Promise<ScrapeResult> {
    const { maxChars = 25000, waitUntil = 'networkidle0' } = options;

    const res = await fetch(`${this.baseUrl}/scrape?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        url,
        options: {
          waitUntil,
          setTimeout: 30000,
        },
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Browserless.io returned ${res.status}: ${errText}`);
    }

    const data = await res.json();

    const title = data.title || url;
    let content = data.text || data.body || data.content || '';

    // Clean up
    content = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);

    return { url, title, content: content || '(empty page)', source: 'browserless' };
  }

  async screenshot(url: string, apiKey: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/screenshot?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: {
          fullPage: true,
          type: 'jpeg',
          quality: 80,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Browserless screenshot returned ${res.status}`);

    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async search(query: string, apiKey: string): Promise<{ title: string; url: string; snippet: string; source: string }[]> {
    // Browserless doesn't have a search API, but we can use it to scrape a search page
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const result = await this.scrape(searchUrl, apiKey, { maxChars: 30000 });
      // Extract links and snippets from the scraped search page
      const results: { title: string; url: string; snippet: string; source: string }[] = [];
      const linkRegex = /(?:^|\n)([^\n]+?)\n\s*(https?:\/\/[^\s\n]+)/g;
      let match;
      while ((match = linkRegex.exec(result.content)) !== null) {
        const title = match[1].replace(/<[^>]+>/g, '').trim();
        const url = match[2].trim();
        if (title && url && title.length > 3 && url.startsWith('http')) {
          const snippet = result.content.slice(match.index + match[0].length, match.index + match[0].length + 150)
            .replace(/\n/g, ' ').trim();
          results.push({ title, url, snippet, source: 'browserless' });
        }
      }
      return results.slice(0, 7);
    } catch (e) {
      logger.warn('[BrowserlessIO] Search via scrape failed:', e);
      return [];
    }
  }
}

export const browserlessIO = new BrowserlessIO();
