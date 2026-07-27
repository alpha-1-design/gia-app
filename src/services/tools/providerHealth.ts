import { providerMonitor } from '../ProviderMonitor';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const providerHealthTools: Tool[] = [
  {
    id: 'provider_health_list',
    name: 'provider_health_list',
    description: 'List all provider/model pairs with their current health status (healthy, degraded, down).',
    execute: async () => {
      try {
        const { providers } = (await import('../../store/useProviderStore')).useProviderStore.getState();
        const results: string[] = [];
        for (const [provId, config] of Object.entries(providers)) {
          if (!config.model) continue;
          const health = providerMonitor.getHealth(provId, config.model);
          results.push(`${provId}/${config.model}: ${health.status} (${health.successRate.toFixed(0)}% success, ${health.avgLatencyMs ?? 'n/a'}ms avg)`);
        }
        return { success: true, content: results.length ? `## Provider Health\n\n${results.join('\n')}` : 'No providers configured.' };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'provider_health_status',
    name: 'provider_health_status',
    description: 'Get detailed health status for a specific provider/model pair.',
    schema: {
      type: 'object',
      properties: {
        providerId: { type: 'string', description: 'The provider ID (e.g., openai, anthropic, google)' },
        modelId: { type: 'string', description: 'The model ID (e.g., gpt-4o, claude-sonnet-4)', optional: true },
      },
      required: ['providerId'],
    },
    execute: async (args) => {
      const providerId = args.providerId as string;
      const modelId = args.modelId as string | undefined;
      try {
        const { providers } = (await import('../../store/useProviderStore')).useProviderStore.getState();
        const config = providers[providerId as string];
        if (!config) return { success: false, content: '', error: `Unknown provider: ${providerId}` };
        const model = modelId || config.model;
        if (!model) return { success: false, content: '', error: `No model configured for ${providerId}.` };
        const health = providerMonitor.getHealth(providerId, model);
        return { success: true, content: `## Provider Health: ${providerId}/${model}\n\n**Status:** ${health.status}\n**Success Rate:** ${(health.successRate * 100).toFixed(1)}%\n**Avg Latency:** ${health.avgLatencyMs ?? 'n/a'}ms\n**Error Rate:** ${health.errorRate.toFixed(2)}%\n**Last Checked:** ${new Date(health.lastChecked).toLocaleString()}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'provider_switch_suggest',
    name: 'provider_switch_suggest',
    description: 'Suggest the best available provider/model based on current health metrics.',
    execute: async () => {
      try {
        const { providers } = (await import('../../store/useProviderStore')).useProviderStore.getState();
        const suggestions: Array<{ provider: string; model: string; status: string; latency: number | null }> = [];
        for (const [provId, config] of Object.entries(providers)) {
          if (!config.model || !config.apiKey) continue;
          const health = providerMonitor.getHealth(provId, config.model);
          suggestions.push({ provider: provId, model: config.model, status: health.status, latency: health.avgLatencyMs });
        }
        if (suggestions.length === 0) return { success: true, content: 'No healthy providers available.' };
        const healthy = suggestions.filter(s => s.status === 'healthy').sort((a, b) => (a.latency ?? Infinity) - (b.latency ?? Infinity));
        const degraded = suggestions.filter(s => s.status === 'degraded').sort((a, b) => (a.latency ?? Infinity) - (b.latency ?? Infinity));
        const down = suggestions.filter(s => s.status === 'down');
        let text = '## Provider Switch Suggestion\n\n';
        if (healthy.length) text += '**Healthy (use these first):**\n' + healthy.map(h => `- ${h.provider}/${h.model} (${h.latency ?? 'n/a'}ms)\n`).join('');
        if (degraded.length) text += '**Degraded (fallback):**\n' + degraded.map(d => `- ${d.provider}/${d.model} (${d.latency ?? 'n/a'}ms)\n`).join('');
        if (down.length) text += '**Down (avoid):**\n' + down.map(d => `- ${d.provider}/${d.model}\n`).join('');
        return { success: true, content: text };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
];

export function registerProviderHealthTools() {
  for (const tool of providerHealthTools) ToolRegistry.register(tool);
}