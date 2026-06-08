import { useProviderStore } from '../../store/useProviderStore';
import { providerRegistry } from '../ProviderRegistry';
import { buildGiaSystem } from '../buildGiaSystem';

export async function delegateTask(providerName: string, prompt: string, signal?: AbortSignal): Promise<string> {
  const { providers } = useProviderStore.getState();
  const targetProvider = providerName.toLowerCase();
  const config = providers[targetProvider];
  if (!config || !config.enabled) return `Error: Provider ${providerName} is not configured.`;

  const def = providerRegistry.getProvider(targetProvider);
  if (!def) return `Error: Provider ${providerName} is not supported.`;

  const systemPrompt = buildGiaSystem(prompt) + "\n\nYou are a specialized GIA sub-agent. Help the main agent fulfill the user's request. You have full tool access.";

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
      return data.content?.find(b => b.type === 'text')?.text ?? 'Sub-agent failed to respond.';
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
  } catch (e: unknown) {
    return `Error delegating: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}
