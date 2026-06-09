import { useGiaStore } from '../../store/useGiaStore';
import { providerRegistry } from '../ProviderRegistry';
import type { Tool } from './types';
export const memoryTools: Tool[] = [
  {
    id: 'forget_memory', name: 'forget_memory',
    description: 'Delete a specific memory or all memories matching a topic.',
    execute: async ({ key, all = false }) => {
      const store = (await import('../../store/useMemoryStore')).useMemoryStore.getState();
      if (all) {
        store.clearMemories();
        return { success: true, content: 'All memories cleared.' };
      }
      const matches = store.queryMemories(key as string);
      matches.forEach(m => store.deleteMemory(m.id));
      return {
        success: true,
        content: matches.length > 0
          ? `Forgot ${matches.length} memor${matches.length === 1 ? 'y' : 'ies'} about "${key}".`
          : `No memories found matching "${key}".`
      };
    }
  },
  {
    id: 'summarize_conversation', name: 'summarize_conversation',
    description: 'Generate a concise summary of the current conversation to save context space.',
    execute: async ({ messages: msgs }) => {
      try {
        const { activeProvider, providers } = (await import('../../store/useProviderStore')).useProviderStore.getState();
        const config = providers[activeProvider];
        if (!config?.apiKey) return { success: false, content: '', error: 'No provider configured.' };
        const textToSummarize = Array.isArray(msgs) ? msgs.map((m: { role: string; content: string | { type: string; text?: string }[] }) => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 1000) : ''}`).join('\n').slice(0, 15000) : '';

        if (activeProvider === 'anthropic') {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: config.model, max_tokens: 512, temperature: 0.3, system: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.', messages: [{ role: 'user', content: textToSummarize }] }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { content?: { type: string; text?: string }[] };
          return { success: true, content: data.content?.find((b: { type: string }) => b.type === 'text')?.text || 'Summary unavailable.' };
        }

        if (activeProvider === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: textToSummarize }] }], system_instruction: { parts: [{ text: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.' }] }, generationConfig: { temperature: 0.3, maxOutputTokens: 512 } }),
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          return { success: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary unavailable.' };
        }

        const baseUrl = providerRegistry.getBaseUrl(activeProvider);
        if (!baseUrl) return { success: false, content: '', error: `Unknown provider: ${activeProvider}` };
        const headers: Record<string, string> = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
        if (activeProvider === 'openrouter') { headers['HTTP-Referer'] = 'https://gia.app'; headers['X-Title'] = 'GIA'; }
        const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: 'Summarize this conversation concisely. Capture key facts, decisions, and user preferences.' }, { role: 'user', content: textToSummarize }], temperature: 0.3, max_tokens: 512 }), signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { success: true, content: data.choices?.[0]?.message?.content || 'Summary unavailable.' };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'export_brain', name: 'export_brain',
    description: 'Export all GIA memories, identity, and skills as a downloadable JSON file.',
    execute: async () => {
      try {
        const { exportBrainToFile } = await import('../BrainExport');
        exportBrainToFile();
        useGiaStore.getState().addNotification('Brain export downloaded');
        return { success: true, content: 'Brain data exported — check your downloads for gia-brain-*.json' };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'import_brain', name: 'import_brain',
    description: 'Upload and restore GIA knowledge from a previously exported .gia-brain.json file.',
    execute: async () => {
      return { success: false, content: '', error: 'File upload must be done manually in Settings > Brain Export. Tell the user to go there.' };
    }
  }
];
