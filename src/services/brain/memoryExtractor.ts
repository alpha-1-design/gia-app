import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import { providerRegistry } from '../ProviderRegistry';

export async function extractMemories(userMessage: string, assistantResponse: string): Promise<void> {
  if (!userMessage || !assistantResponse || assistantResponse.length < 100) return;

  const { activeProvider, providers } = useProviderStore.getState();
  const config = providers[activeProvider];
  if (!config?.apiKey) return;

  const extractionPrompt = `Analyze this conversation exchange and extract any facts worth remembering about the user.

User said: "${userMessage.slice(0, 500)}"
Assistant said: "${assistantResponse.slice(0, 500)}"

Extract ONLY concrete, specific facts about the USER (not general knowledge).
Categories: name, age, location, profession, goals, preferences, struggles, projects, skills, relationships.

If nothing worth remembering, return: []

Return JSON array only, no other text:
[{"key": "user_name", "value": "Sam", "category": "profile", "confidence": 0.95}]

Valid categories: "profile" | "subject" | "score" | "weak_area" | "fact" | "preference" | "session_summary"`;

  let text = '';

  try {
    let res: Response;
    if (activeProvider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 300,
          system: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.',
          messages: [{ role: 'user', content: extractionPrompt }],
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const data: { content?: { type: string; text?: string }[] } = await res.json();
      text = data.content?.find(b => b.type === 'text')?.text || '';
    } else if (activeProvider === 'gemini') {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
          system_instruction: { parts: [{ text: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.' }] },
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } = await res.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const baseUrl = providerRegistry.getBaseUrl(activeProvider);
      if (!baseUrl) return;
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(activeProvider === 'openrouter' ? { 'HTTP-Referer': 'https://gia.app', 'X-Title': 'GIA' } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: 'You are a memory extraction assistant. Return only valid JSON arrays. Never include markdown.' },
            { role: 'user', content: extractionPrompt },
          ],
          max_tokens: 300,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || '';
    }
    const cleaned = text.replace(/```json|```/g, '').trim();
    const entries = JSON.parse(cleaned);
    if (Array.isArray(entries) && entries.length > 0) {
      useMemoryStore.getState().addMemories(entries);
      useMemoryStore.getState().compactMemories();
    }
  } catch (e) {
    logger.warn('[MemoryExtractor] Non-critical memory extraction skipped:', e instanceof Error ? e.message : e);
  }
}
