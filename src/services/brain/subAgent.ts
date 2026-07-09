import { useProviderStore } from '../../store/useProviderStore';
import { useAgentStore } from '../../store/useAgentStore';
import { providerRegistry } from '../ProviderRegistry';
import { buildGiaSystem } from '../buildGiaSystem';

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

export async function delegateTask(
  providerName: string,
  prompt: string,
  signal?: AbortSignal,
  agentId?: string,
): Promise<string> {
  const { providers } = useProviderStore.getState();
  const targetProvider = providerName.toLowerCase();
  const config = providers[targetProvider];
  if (!config || !config.enabled) return `Error: Provider ${providerName} is not configured.`;

  const def = providerRegistry.getProvider(targetProvider);
  if (!def) return `Error: Provider ${providerName} is not supported.`;

  // Resolve a real persona for this sub-agent call — either the one GIA
  // explicitly named, or the best keyword match against the task text.
  // This replaces a system-prompt claim that auto-selection happened when
  // no such mechanism previously existed.
  const explicitAgent = agentId ? useAgentStore.getState().agents.find(a => a.id === agentId || a.name.toLowerCase() === agentId.toLowerCase()) : undefined;
  const matchedAgent = explicitAgent || selectBestAgent(prompt);

  const systemPrompt = buildGiaSystem(prompt) + (matchedAgent
    ? `\n\nYou are "${matchedAgent.name}" — embody this persona fully.\nYour purpose: ${matchedAgent.description}\n${matchedAgent.systemPrompt}\n\nYou are a specialized GIA sub-agent operating as this persona. Help the main agent fulfill the user's request. You have full tool access.`
    : "\n\nYou are a specialized GIA sub-agent. Help the main agent fulfill the user's request. You have full tool access.");

  try {
    if (targetProvider === 'anthropic') {
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
      const outText = data.content?.find(b => b.type === 'text')?.text ?? 'Sub-agent failed to respond.';
      return matchedAgent ? `[via ${matchedAgent.name}]\n${outText}` : outText;
    }

    if (targetProvider === 'gemini') {
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
      const outText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sub-agent failed to respond.';
      return matchedAgent ? `[via ${matchedAgent.name}]\n${outText}` : outText;
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
    const outText = data.choices?.[0]?.message?.content || data.content || "Sub-agent failed to respond.";
    return matchedAgent ? `[via ${matchedAgent.name}]\n${outText}` : outText;
  } catch (e: unknown) {
    return `Error delegating: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}
