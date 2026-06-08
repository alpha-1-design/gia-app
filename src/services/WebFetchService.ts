import { logger } from '../utils/logger';

export interface FetchedPage {
  url: string;
  title: string;
  content: string;
  excerpt: string;
  siteName: string;
  contentType: string;
  length: number;
}

const CORS_PROXIES = [
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.corsfix.com/proxy?url=${encodeURIComponent(u)}`,
  (u: string) => `https://cors-anywhere.herokuapp.com/${u}`,
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<[/]title>/i);
  if (m) return m[1].trim();
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  if (og) return og[1].trim();
  return '';
}

function extractSiteName(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i);
  if (og) return og[1].trim();
  const host = html.match(/https?:\/\/([^/]+)/);
  return host ? host[1] : '';
}

function extractDescription(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  if (og) return og[1].trim();
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  if (meta) return meta[1].trim();
  return '';
}

function stripHTML(html: string): string {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[/]*?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function extractMainContent(html: string): string {
  const articleMatch = html.match(/<article[^>]*>[\s\S]*?<\/article>/i);
  if (articleMatch) return stripHTML(articleMatch[0]);
  const mainMatch = html.match(/<main[^>]*>[\s\S]*?<\/main>/i);
  if (mainMatch) return stripHTML(mainMatch[0]);
  const bodyMatch = html.match(/<body[^>]*>[\s\S]*?<\/body>/i);
  if (bodyMatch) {
    const body = bodyMatch[0]
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    return stripHTML(body);
  }
  return stripHTML(html);
}

function htmlToBasicMarkdown(html: string): string {
  let md = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  md = md
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .trim();

  return md;
}

class WebFetchService {
  private cache = new Map<string, { page: FetchedPage; ts: number }>();
  private cacheTTL = 180_000;

  async fetch(url: string, options?: { format?: 'text' | 'markdown'; maxChars?: number }): Promise<FetchedPage> {
    const format = options?.format || 'markdown';
    const maxChars = options?.maxChars || 60000;
    const cacheKey = `${url}::${format}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.cacheTTL) return cached.page;

    const page = await this.fetchRaw(url, format, maxChars);
    this.cache.set(cacheKey, { page, ts: Date.now() });
    return page;
  }

  private async fetchRaw(url: string, format: 'text' | 'markdown', maxChars: number): Promise<FetchedPage> {
    let lastError = '';

    // Strategy 1: Direct fetch (may fail CORS)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': pickUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      if (res.ok) {
        const html = await res.text();
        return this.processHTML(url, html, format, maxChars);
      }
      lastError = `HTTP ${res.status}`;
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
    }

    // Strategy 2: Try CORS proxies
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = CORS_PROXIES[i](url);
        const res = await fetch(proxyUrl, {
          headers: { 'User-Agent': pickUA(), 'Accept': 'text/html,*/*' },
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (res.ok) {
          const html = await res.text();
          return this.processHTML(url, html, format, maxChars);
        }
        lastError = `Proxy ${i}: HTTP ${res.status}`;
      } catch (e: unknown) {
        lastError = `Proxy ${i}: ${e instanceof Error ? e.message : 'Failed'}`;
      }
    }

    // Strategy 3: Use textise dot iitty (lightweight text view)
    try {
      const textiseUrl = `https://r.jina.ai/http://${new URL(url).host}${new URL(url).pathname}`;
      const res = await fetch(textiseUrl, {
        headers: {
          'User-Agent': pickUA(),
          'Accept': 'text/plain',
          'X-With-Generated-Alt': 'true',
          'X-With-Iframe': 'true',
          'X-Return-Format': 'text',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const text = await res.text();
        const title = extractTitle(text) || new URL(url).hostname;
        const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, maxChars);
        const page: FetchedPage = {
          url, title, content: cleanText, excerpt: cleanText.slice(0, 300),
          siteName: new URL(url).hostname, contentType: 'text/plain', length: cleanText.length,
        };
        return page;
      }
    } catch (e) { logger.error('[WebFetchService] Fetch strategy failed:', e); }

    throw new Error(`Failed to fetch ${url}: all strategies exhausted. Last error: ${lastError}`);
  }

  private processHTML(url: string, html: string, format: 'text' | 'markdown', maxChars: number): FetchedPage {
    const title = extractTitle(html);
    const siteName = extractSiteName(html);
    const desc = extractDescription(html);

    let content: string;
    if (format === 'markdown') {
      content = htmlToBasicMarkdown(html);
      const mainText = extractMainContent(html);
      if (mainText.length > content.length * 0.3) {
        content = htmlToBasicMarkdown(html.replace(/<(nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, ''));
      }
    } else {
      content = stripHTML(html);
    }

    content = content.slice(0, maxChars);

    const excerpt = desc || content.slice(0, 300);

    return {
      url, title, content, excerpt,
      siteName, contentType: 'text/html', length: content.length,
    };
  }
}

export default new WebFetchService();
