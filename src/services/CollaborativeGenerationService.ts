import { useProviderStore } from '../store/useProviderStore';
import { BrainRequest, BrainResponse, CollaborativeProviderStatus } from './providers/types';
import GiaBrain from './GiaBrain';
import ProviderMonitor from './ProviderMonitor';
import { providerRegistry } from './ProviderRegistry';

const MAX_COLLABORATIVE_PROVIDERS = 3;

class CollaborativeGenerationService {
  async generate(req: BrainRequest, onProviderStatus?: (status: CollaborativeProviderStatus) => void): Promise<BrainResponse> {
    await providerRegistry.ensureLoaded();
    const { providers, activeProvider } = useProviderStore.getState();
    const configured = Object.entries(providers)
      .filter(([id, cfg]) => {
        const definition = providerRegistry.getProvider(id);
        return Boolean(definition?.needsApiKey && cfg.enabled && cfg.apiKey.trim());
      })
      .map(([id, cfg]) => ({ id, model: cfg.model }))
      .sort((a, b) => Number(b.id === activeProvider) - Number(a.id === activeProvider))
      .slice(0, MAX_COLLABORATIVE_PROVIDERS);

    if (configured.length === 0) {
      return GiaBrain.generate(req);
    }

    const checks = await Promise.all(configured.map(async (provider) => {
      onProviderStatus?.({ provider: provider.id, model: provider.model, status: 'checking' });
      let health;
      try {
        health = await ProviderMonitor.testProvider(provider.id);
      } catch (error) {
        onProviderStatus?.({
          provider: provider.id,
          model: provider.model,
          status: 'error',
          activity: error instanceof Error ? error.message : 'Endpoint check failed',
        });
        return null;
      }
      if (!health.online) {
        onProviderStatus?.({ provider: provider.id, model: provider.model, status: 'error', activity: health.lastError || 'Endpoint unreachable; skipped' });
        return null;
      }
      return provider;
    }));
    const connected = checks.filter((provider): provider is { id: string; model: string } => provider !== null);

    if (connected.length === 0) {
      throw new Error('Multi-Provider Collaboration could not reach any configured cloud provider. Check the provider API keys and endpoints in Settings.');
    }

    const primary = connected[0];
    const others = connected.slice(1);

    for (const provider of connected) {
      onProviderStatus?.({ provider: provider.id, model: provider.model, status: 'thinking' });
    }

    const peerResults: { provider: string; model: string; text: string }[] = [];

    const peerPromises = others.map(async (p) => {
      onProviderStatus?.({ provider: p.id, model: p.model, status: 'thinking' });
      try {
        const label = providerRegistry.getLabel(p.id);
        const peerReq: BrainRequest = {
          ...req,
          providerId: p.id,
          modelOverride: p.model,
          onStream: undefined,
          onThought: (activity) => {
            onProviderStatus?.({ provider: p.id, model: p.model, status: 'researching', activity });
            req.onThought?.(`[${label}] ${activity}`);
          },
          onThinkingDelta: undefined,
        };
        const res = await GiaBrain.generate(peerReq);
        onProviderStatus?.({ provider: p.id, model: p.model, status: 'done' });
        return { provider: p.id, model: p.model, text: res.text };
      } catch {
        onProviderStatus?.({ provider: p.id, model: p.model, status: 'error' });
        return null;
      }
    });

    const primaryPromise = (async () => {
      onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'responding' });
      try {
        const label = providerRegistry.getLabel(primary.id);
        const res = await GiaBrain.generate({
          ...req,
          providerId: primary.id,
          modelOverride: primary.model,
          onStream: undefined,
          onThought: (activity) => {
            onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'researching', activity });
            req.onThought?.(`[${label}] ${activity}`);
          },
          onThinkingDelta: undefined,
        });
        onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'done' });
        return { provider: primary.id, model: primary.model, text: res.text };
      } catch {
        onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'error' });
        return null;
      }
    })();

    const allResults = await Promise.all([primaryPromise, ...peerPromises]);
    const validResults = allResults.filter((r): r is { provider: string; model: string; text: string } => r !== null);

    if (validResults.length === 0) {
      throw new Error('All providers failed during collaborative generation');
    }

    if (validResults.length === 1) {
      return { text: validResults[0].text, provider: validResults[0].provider, model: validResults[0].model };
    }

    peerResults.push(...validResults);

    const synthesisPrompt = `You are a synthesis agent. Multiple AI models have responded to the same user query. Your job is to combine their perspectives into one clear, comprehensive, agreed-upon answer.\n\nUSER QUERY:\n${req.prompt}\n\n--- RESPONSES ---\n${peerResults.map((r, i) => `[${i + 1}] ${r.provider}/${r.model}:\n${r.text}`).join('\n\n')}\n--- END RESPONSES ---\n\nSynthesize these into ONE coherent response. Use the strongest parts from each. If they disagree, acknowledge the different perspectives but provide the most well-reasoned conclusion. Do NOT list them separately — produce a single unified answer.`;

    onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'synthesizing', activity: `Combining ${validResults.length} provider responses` });
    return GiaBrain.generate({
      ...req,
      providerId: primary.id,
      prompt: synthesisPrompt,
      onStream: req.onStream,
      onThought: (t) => {
        onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'synthesizing', activity: t });
        req.onThought?.(`[Synthesis] ${t}`);
      },
      onThinkingDelta: (t) => req.onThinkingDelta?.(t),
    });
  }
}

export default new CollaborativeGenerationService();
