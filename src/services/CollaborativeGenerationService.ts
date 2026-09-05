import { useProviderStore } from '../store/useProviderStore';
import { BrainRequest, BrainResponse } from './providers/types';
import GiaBrain from './GiaBrain';

class CollaborativeGenerationService {
  async generate(req: BrainRequest, onProviderStatus?: (status: { provider: string; model: string; status: 'thinking' | 'responding' | 'done' | 'error' }) => void): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const connected = Object.entries(providers)
      .filter(([id, cfg]) => cfg.enabled && (id === 'local-llm' || cfg.apiKey))
      .map(([id, cfg]) => ({ id, model: cfg.model }));

    if (connected.length < 2) {
      return GiaBrain.generate(req);
    }

    const primary = connected[0];
    const others = connected.slice(1);

    onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'thinking' });

    const peerResults: { provider: string; model: string; text: string }[] = [];

    const peerPromises = others.map(async (p) => {
      onProviderStatus?.({ provider: p.id, model: p.model, status: 'thinking' });
      try {
        const peerReq: BrainRequest = { ...req, providerId: p.id, modelOverride: p.model, onStream: undefined, onThought: undefined, onThinkingDelta: undefined };
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
        const res = await GiaBrain.generate({ ...req, providerId: primary.id, onStream: undefined, onThought: undefined, onThinkingDelta: undefined });
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

    return GiaBrain.generate({
      ...req,
      providerId: primary.id,
      prompt: synthesisPrompt,
      onStream: req.onStream,
      onThought: (t) => req.onThought?.(`[Synthesis] ${t}`),
      onThinkingDelta: (t) => req.onThinkingDelta?.(t),
    });
  }
}

export default new CollaborativeGenerationService();
