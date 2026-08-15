import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';
import { useSearchStore } from '../../store/useSearchStore';

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
        // Persist into the SAME store the Settings → Search screen uses, so a
        // key configured by the AI is visible in Settings and vice-versa.
        const search = useSearchStore.getState();
        search.setSearchProviderKey(provider as 'exa' | 'browserless', apiKey);
        search.setSearchProviderEnabled(provider as 'exa' | 'browserless', true);
        search.setActiveSearchProvider(provider as 'exa' | 'browserless');
        // Legacy mirror for anything still reading the old localStorage key.
        try { localStorage.setItem(`gia-search-${provider}`, apiKey); } catch { /* ignore */ }
        return { success: true, content: `${provider === 'exa' ? 'Exa Search' : 'Browserless.io'} API key configured and activated.` };
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
      const store = useSearchStore.getState();
      const exa = store.providers.exa;
      const browserless = store.providers.browserless;
      const configured = (p: typeof exa) => (p.enabled && p.apiKey ? 'configured & active' : p.apiKey ? 'key saved, not enabled' : 'not configured');
      return {
        success: true,
        content: `## Search Providers\n\n**Exa:** ${configured(exa)}\n**Browserless:** ${configured(browserless)}\n**Active provider:** ${store.activeSearchProvider === 'none' ? 'fallback (DuckDuckGo/Google, no API key)' : store.activeSearchProvider}\n\nBoth providers are used automatically by web_search and read_url when configured.`,
      };
    }
  },
];

export function registerSearchConfigTools() {
  for (const tool of searchConfigTools) ToolRegistry.register(tool);
}
