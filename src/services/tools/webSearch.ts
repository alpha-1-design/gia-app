import { z } from 'zod';
import type { Tool } from './types';
import { useGiaStore } from '../../store/useGiaStore';

const webSearchTool: Tool = {
  id: 'web_search',
  name: 'web_search',
  description: 'Search the web for real-time information using multiple search engines (DuckDuckGo, Google, Bing, Wikipedia). Falls back automatically if one engine fails.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' }
    },
    required: ['query']
  },
  execute: async ({ query }) => {
    // Validate input using Zod
    const searchSchema = z.object({
      query: z.string().min(1, "Search query cannot be empty").max(500, "Search query too long")
    });

    const validationResult = searchSchema.safeParse({ query });
    if (!validationResult.success) {
      return {
        success: false,
        content: '',
        error: `Invalid search query: ${validationResult.error.issues.map((e: z.ZodIssue) => (e instanceof Error ? e.message : String(e))).join(', ')}`
      };
    }

    try {
      const { default: fallback } = await import('../FallbackWebSearch');
      const results = await fallback.search(query as string);
      if (results.length === 0) return { success: true, content: 'No results found.', sources: [] };
      const content = results.map((r, i) =>
        `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}\n    _(via ${r.source})_`
      ).join('\n\n');
      return {
        success: true,
        content: `WEB SEARCH RESULTS for "${query}":\n\n${content}\n\nUse these results to inform your response. Cite sources using [1], [2], etc.`,
        sources: results.map(r => ({ title: r.title, url: r.url })),
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
    }
  }
};

const readUrlTool: Tool = {
  id: 'read_url', name: 'read_url',
  description: 'Extract clean text/markdown from any web page. Uses multiple CORS proxies and content extraction strategies. Converts HTML to readable markdown with links, headings, code blocks preserved. Best for reading articles, docs, and web content.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to fetch (https://...)' },
      format: { type: 'string', enum: ['markdown', 'text'], description: 'Output format — markdown (default) preserves structure, text is plain' },
      maxChars: { type: 'number', description: 'Max characters to return (default 60000)' },
    },
    required: ['url'],
  },
  execute: async ({ url, maxChars }) => {
    try {
      const { default: fallback } = await import('../FallbackWebSearch');
      const page = await fallback.scrape(url as string, (maxChars as number) || 60000);
      const header = `# ${page.title}\n*From [${page.url}](${page.url})* ~ Source: ${page.source}\n\n`;
      const excerpt = page.content.length > 0 ? '' : `*No content extracted.*\n`;
      return { success: true, content: `${header}${excerpt}${page.content}`, sources: [{ title: page.title || url as string, url: url as string }] };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Fetch failed' };
    }
  }
};

const browserNavigateTool: Tool = {
  id: 'browser_navigate', name: 'browser_navigate',
  description: 'Full browser page navigation — fetches the page, renders JavaScript, and extracts rendered text content. Supports both static and dynamic (SPA) pages. Set a CORS proxy in Settings for cross-origin pages.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The full URL to navigate to (https://...)' },
    },
    required: ['url'],
  },
  execute: async ({ url }) => {
    try {
      if (!url || typeof url !== 'string') return { success: false, content: '', error: 'URL is required' };
      const BrowserRunner = (await import('../BrowserRunner')).default;
      useGiaStore.getState().addNotification(`🌐 Navigating to ${new URL(url).hostname}…`);
      const result = await BrowserRunner.navigate(url, (status) => {
        useGiaStore.getState().addNotification(`🌐 ${status}`);
      });
      const snippet = result.text.slice(0, 2000);
      const title = result.title ? `**${result.title}**\n\n` : '';
      const summary = snippet.length < result.text.length
        ? `\n\n*(Content truncated — ${result.text.length} chars total)*`
        : '';
      return { success: true, content: `${title}${snippet}${summary}` };
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return { success: false, content: '', error: 'Cancelled' };
      const msg = e instanceof Error ? e.message : 'Browser navigation failed';
      if (msg.includes('CORS')) return { success: false, content: '', error: `${msg}\n\nConfigure a CORS proxy in Settings → Browser Automation or use read_url for static pages.` };
      return { success: false, content: '', error: msg };
    }
  }
};

const pageInfoTool: Tool = {
  id: 'page_info', name: 'page_info',
  description: 'Get metadata (title, description, site name) from any URL without fetching the full page. Lightweight alternative to read_url when you just need a preview.',
  schema: {
    type: 'object', properties: {
      url: { type: 'string', description: 'URL to get metadata from' },
    }, required: ['url'],
  },
  execute: async ({ url }) => {
    try {
      const tb = (await import('../ToolboxService')).default;
      const meta = await tb.getPageMetadata(url as string);
      return { success: true, content: `**${meta.title}**\n${meta.description || ''}\n*${meta.siteName || ''}*\n${url}` };
    } catch (e: unknown) { return { success: false, content: '', error: e instanceof Error ? e.message : 'Metadata fetch failed' }; }
  }
};

export const webSearchTools: Tool[] = [webSearchTool, readUrlTool, browserNavigateTool, pageInfoTool];
