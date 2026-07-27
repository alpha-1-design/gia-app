import responseCache from '../ResponseCache';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const responseCacheTools: Tool[] = [
  {
    id: 'cache_stats',
    name: 'cache_stats',
    description: 'Show response cache statistics (size, oldest/newest entries).',
    execute: async () => {
      const stats = responseCache.stats();
      return { success: true, content: `## Response Cache\n\n**Entries:** ${stats.size}\n**Max Entries:** ${responseCache.maxEntries}\n**Default TTL:** ${(responseCache.defaultTTL / 60000).toFixed(0)} min\n**Oldest Entry:** ${stats.oldest ? new Date(stats.oldest).toLocaleString() : 'n/a'}\n**Newest Entry:** ${stats.newest ? new Date(stats.newest).toLocaleString() : 'n/a'}` };
    }
  },
  {
    id: 'cache_clear',
    name: 'cache_clear',
    description: 'Clear the response cache. Optionally clear entries for a specific provider or model.',
    schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'Optional: clear entries for this provider only' },
        model: { type: 'string', description: 'Optional: clear entries for this model only' },
      },
    },
    execute: async (args) => {
      const provider = args.provider as string | undefined;
      const model = args.model as string | undefined;
      if (provider || model) {
        responseCache.invalidate(provider, model);
        return { success: true, content: `Cache invalidated for ${provider ? provider : 'all providers'}${model ? ` / ${model}` : ''}.` };
      }
      responseCache.invalidate();
      return { success: true, content: 'Response cache cleared.' };
    }
  },
];

export function registerResponseCacheTools() {
  for (const tool of responseCacheTools) ToolRegistry.register(tool);
}