import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const searchConfigTools: Tool[] = [
  {
    id: 'search_provider_configure',
    name: 'search_provider_configure',
    description: 'Configure a search provider (Exa Search or Browserless.io) with an API key.',
    schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['exa', 'browserless'], description: 'Which search provider to configure' },
        apiKey: { type: 'string', description: 'The API key for the provider' },
      },
      required: ['provider', 'apiKey'],
    },
    execute: async (args) => {
      const provider = args.provider as string;
      const apiKey = args.apiKey as string;
      if (!provider || !['exa', 'browserless'].includes(provider)) {
        return { success: false, content: '', error: 'Provider must be "exa" or "browserless".' };
      }
      if (!apiKey) return { success: false, content: '', error: 'Provide an "apiKey".' };
      try {
        localStorage.setItem(`gia-search-${provider}`, apiKey);
        return { success: true, content: `${provider === 'exa' ? 'Exa Search' : 'Browserless.io'} API key configured.` };
      } catch {
        return { success: false, content: '', error: 'Failed to save configuration.' };
      }
    }
  },
  {
    id: 'search_provider_status',
    name: 'search_provider_status',
    description: 'Check which search providers are configured and active.',
    execute: async () => {
      const exaKey = (() => { try { return localStorage.getItem('gia-search-exa'); } catch { return null; } })();
      const browserlessKey = (() => { try { return localStorage.getItem('gia-search-browserless'); } catch { return null; } })();
      return { success: true, content: `## Search Providers\n\n**Exa:** ${exaKey ? 'configured' : 'not configured'}\n**Browserless:** ${browserlessKey ? 'configured' : 'not configured'}\n**Active fallback:** DuckDuckGo/Google (no API key required)` };
    }
  },
];

export function registerSearchConfigTools() {
  for (const tool of searchConfigTools) ToolRegistry.register(tool);
}