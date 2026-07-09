import { useProviderStore } from '../../store/useProviderStore';
import { useAgentStore } from '../../store/useAgentStore';
import { providerRegistry } from '../ProviderRegistry';
import { buildGiaSystem } from '../buildGiaSystem';
import { isRateLimitOrQuotaError, isRetryableServerError, pickFallbackProvider, backoffDelay } from './ResilientRelay';
import ProviderMonitor from '../ProviderMonitor';

/**
 * Picks the persona whose description shares the most overlapping
 * significant words with the task prompt. Lightweight, not ML-based —
 * but it's a real mechanism, not a documented-but-nonexistent one.
 */
function selectBestAgent(prompt: string): { id: string; name: string; description: string; systemPrompt: string } | undefined {
  const agents = useAgentStore.getState().agents;
  if (agents.length === 0) return undefined;
  const promptWords = new Set(
    prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  let best: typeof agents[number] | undefined;
  let bestScore = 0;
  for (const a of agents) {
    const descWords = a.description.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const score = descWords.reduce((acc, w) => acc + (promptWords.has(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return bestScore > 0 ? best : undefined;
}

/** A single, non-streaming completion call against one specific provider. Throws on failure. */
async function callProviderOnce(providerId: string, prompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
  const { providers } = useProviderStore.getState();
  const config = providers[providerId];
  if (!config || !config.enabled) throw new Error(`Provider ${providerId} is not configured.`);
  const def = providerRegistry.getProvider(providerId);
  if (!def) throw new Error(`Provider ${providerId} is not supported.`);

  if (providerId === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { content?: { type: string; text?: string }[] } = await res.json();
    return data.content?.find(b => b.type === 'text')?.text ?? 'Sub-agent failed to respond.';
  }

  if (providerId === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        system_instruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sub-agent failed to respond.';
  }

  // OpenAI-compatible providers
  const baseUrl = def.baseUrl;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    }),
    signal
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || data.content || "Sub-agent failed to respond.";
}

export async function delegateTask(
  providerName: string,
  prompt: string,
  signal?: AbortSignal,
  agentId?: string,
  onStatus?: (msg: string) => void,
): Promise<string> {
  const targetProvider = providerName.toLowerCase();

  // Resolve a real persona for this sub-agent call — either the one GIA
  // explicitly named, or the best keyword match against the task text.
  // This replaces a system-prompt claim that auto-selection happened when
  // no such mechanism previously existed.
  const explicitAgent = agentId ? useAgentStore.getState().agents.find(a => a.id === agentId || a.name.toLowerCase() === agentId.toLowerCase()) : undefined;
  const matchedAgent = explicitAgent || selectBestAgent(prompt);

  const systemPrompt = buildGiaSystem(prompt) + (matchedAgent
    ? `\n\nYou are "${matchedAgent.name}" — embody this persona fully.\nYour purpose: ${matchedAgent.description}\n${matchedAgent.systemPrompt}\n\nYou are a specialized GIA sub-agent operating as this persona. Help the main agent fulfill the user's request. You have full tool access.`
    : "\n\nYou are a specialized GIA sub-agent. Help the main agent fulfill the user's request. You have full tool access.");

  const attribute = (text: string) => matchedAgent ? `[via ${matchedAgent.name}]\n${text}` : text;
  const triedProviders: string[] = [];
  let currentProvider = targetProvider;

  // Try the requested provider, then fail over across every other configured
  // provider on a rate limit / overload before giving up — same resilience
  // guarantee as the main chat path, so a Nexus sub-agent can't silently die
  // just because one provider is temporarily out of capacity.
  for (let hop = 0; hop <= 3; hop++) {
    triedProviders.push(currentProvider);
    const callStart = performance.now();
    try {
      const text = await callProviderOnce(currentProvider, prompt, systemPrompt, signal);
      ProviderMonitor.recordSuccess(currentProvider, useProviderStore.getState().providers[currentProvider]?.model || '', Math.round(performance.now() - callStart));
      return attribute(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      ProviderMonitor.recordFailure(currentProvider, useProviderStore.getState().providers[currentProvider]?.model || '', msg, Math.round(performance.now() - callStart));
      const recoverable = isRateLimitOrQuotaError(msg) || isRetryableServerError(msg);
      if (!recoverable) return `Error delegating: ${e instanceof Error ? e.message : 'Unknown error'}`;

      const fallback = pickFallbackProvider(triedProviders);
      if (fallback) {
        onStatus?.(`${currentProvider} rate-limited — retrying as ${fallback.provider}`);
        currentProvider = fallback.provider;
        continue;
      }

      // No fallback left — wait out a short backoff and retry the same
      // provider rather than dropping this sub-agent's task entirely.
      if (hop < 3) {
        const delay = backoffDelay(hop + 1);
        onStatus?.(`All providers busy — retrying ${currentProvider} in ${Math.round(delay / 1000)}s`);
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, delay);
          signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
        });
        continue;
      }
      return `Error delegating: all providers rate-limited or unavailable after retrying (${e instanceof Error ? e.message : 'unknown'})`;
    }
  }
  return 'Error delegating: exhausted retries.';
}
