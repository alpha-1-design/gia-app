import { z } from 'zod';
import type { Tool, ToolContext } from './types';
import { useSearchStore } from '../../store/useSearchStore';
import { useGiaStore } from '../../store/useGiaStore';
import { useKnowledgeGraphStore } from '../../store/useKnowledgeGraphStore';
import ToolRegistry from '../ToolRegistry';

function getSearchDescription(): string {
  const store = useSearchStore.getState();
  const configured: string[] = [];
  if (store.providers.exa.enabled && store.providers.exa.apiKey) configured.push('Exa');
  if (store.providers.browserless.enabled && store.providers.browserless.apiKey) configured.push('Browserless');
  if (configured.length > 0) {
    return `Search the web using ${configured.join(' & ')} (your configured provider). Fast, accurate results. Falls back to DuckDuckGo/Google/Bing if needed.`;
  }
  return 'Search the web for real-time information using DuckDuckGo, Google, Bing, and Wikipedia. Falls back automatically if one engine fails.';
}

const webSearchTool: Tool = {
  id: 'web_search',
  name: 'web_search',
  description: getSearchDescription(),
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' }
    },
    required: ['query']
  },
  execute: async ({ query }, ctx?: ToolContext) => {
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
      ctx?.onProgress?.(0.1, 'Searching...');
      ctx?.onThought?.(`🌐 Searching for "${String(query).slice(0, 60)}"...`);
      const { default: fallback } = await import('../FallbackWebSearch');
      ctx?.onProgress?.(0.3, 'Fetching results...');
      ctx?.onThought?.('Fetching search results...');
      const results = await fallback.search(query as string);
      if (results.length === 0) {
        ctx?.onThought?.('No results found');
        return { success: true, content: 'No results found.', sources: [] };
      }
      ctx?.onProgress?.(0.7, 'Processing results...');
      ctx?.onThought?.(`Found ${results.length} results — processing...`);
      const content = results.map((r, i) =>
        `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}\n    _(via ${r.source})_`
      ).join('\n\n');
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Web search complete');

      // Auto-ingest into Neura knowledge graph
      try {
        const kg = useKnowledgeGraphStore.getState();
        const searchQ = String(query).slice(0, 120);
        const firstResult = results[0];
        const desc = firstResult
          ? `Web search result — ${firstResult.title}. ${firstResult.snippet?.slice(0, 200)}`
          : `Searched for "${searchQ}"`;
        const entityId = kg.addEntity({
          name: searchQ,
          type: 'topic',
          description: desc,
          aliases: [],
          confidence: 0.6,
          metadata: { source: 'web_search', query: searchQ },
        });
        // Add top results as related entities
        for (const r of results.slice(0, 5)) {
          const title = r.title?.slice(0, 100) || 'Untitled';
          const resultId = kg.addEntity({
            name: title,
            type: 'document',
            description: r.snippet?.slice(0, 300) || '',
            aliases: [],
            confidence: 0.4,
            metadata: { source: 'web_search', url: r.url || '' },
          });
          kg.addRelationship({
            sourceId: entityId, targetId: resultId,
            type: 'related_to', strength: 0.5,
            context: `Web search result for "${searchQ}"`,
          });
        }
      } catch {
        // Non-critical — don't fail the search if KG ingestion fails
      }

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
  description: 'Extract clean text/markdown from any web page. Uses Exa/Browserless (if configured) or multiple CORS proxies and content extraction strategies. Converts HTML to readable markdown with links, headings, code blocks preserved. Best for reading articles, docs, and web content.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to fetch (https://...)' },
      format: { type: 'string', enum: ['markdown', 'text'], description: 'Output format — markdown (default) preserves structure, text is plain' },
      maxChars: { type: 'number', description: 'Max characters to return (default 60000)' },
    },
    required: ['url'],
  },
  execute: async ({ url, maxChars }, ctx?: ToolContext) => {
    try {
      ctx?.onProgress?.(0.1, 'Connecting...');
      ctx?.onThought?.(`📄 Connecting to ${new URL(url as string).hostname}...`);
      const { default: fallback } = await import('../FallbackWebSearch');
      ctx?.onProgress?.(0.3, 'Fetching page...');
      ctx?.onThought?.('Fetching page content...');
      const page = await fallback.scrape(url as string, (maxChars as number) || 60000);
      ctx?.onProgress?.(0.7, 'Extracting content...');
      ctx?.onThought?.(`Extracted ${page.content.length} chars from ${page.title || 'page'}`);
      const header = `# ${page.title}\n*From [${page.url}](${page.url})* ~ Source: ${page.source}\n\n`;
      const excerpt = page.content.length > 0 ? '' : `*No content extracted.*\n`;
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Page read complete');
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
  execute: async ({ url }, ctx?: ToolContext) => {
    try {
      if (!url || typeof url !== 'string') return { success: false, content: '', error: 'URL is required' };
      ctx?.onProgress?.(0.1, 'Preparing browser...');
      ctx?.onThought?.(`🌐 Navigating to ${new URL(url).hostname}...`);
      const BrowserRunner = (await import('../BrowserRunner')).default;
      useGiaStore.getState().addNotification(`🌐 Navigating to ${new URL(url).hostname}…`);
      ctx?.onProgress?.(0.3, 'Navigating...');
      ctx?.onThought?.('Loading page in browser...');
      const result = await BrowserRunner.navigate(url, (status) => {
        useGiaStore.getState().addNotification(`🌐 ${status}`);
      });
      ctx?.onProgress?.(0.7, 'Extracting content...');
      ctx?.onThought?.(`Page loaded — extracting ${result.text.length} chars of content...`);
      const snippet = result.text.slice(0, 2000);
      const title = result.title ? `**${result.title}**\n\n` : '';
      const summary = snippet.length < result.text.length
        ? `\n\n*(Content truncated — ${result.text.length} chars total)*`
        : '';
      ctx?.onProgress?.(1, 'Done');
      ctx?.onThought?.('✅ Browser navigation complete');
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


export function registerWebSearchTools() {
  for (const tool of webSearchTools) ToolRegistry.register(tool);
}
