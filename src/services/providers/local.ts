import { logger } from '../../utils/logger';
import type { BrainRequest, BrainResponse, BrainContext } from './types';
import LocalLLMService from '../LocalLLMService';

/**
 * Provider function for the local on-device LLM via @huggingface/transformers.
 * Handles streaming via onToken callbacks, tool calling awareness,
 * and proper error messaging when no model is loaded.
 */
export async function callLocalLLM(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const service = LocalLLMService;

  if (!service.isLoaded()) {
    throw new Error(
      'No local model loaded. Go to Settings → scroll to Local LLM Models → ' +
      'select and download a model first.'
    );
  }

  const modelId = service.getLoadedModel()!;

  // Build messages from prompt + history
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

  // System prompt
  const systemPrompt = ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode);
  messages.push({ role: 'system', content: systemPrompt });

  // History
  if (req.history) {
    for (const msg of req.history) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(c => c.text || '').join('\n');
      messages.push({ role: msg.role as 'user' | 'assistant', content });
    }
  }

  // Current user prompt
  messages.push({ role: 'user', content: req.prompt });

  // Build a lightweight tool-awareness instruction for the system
  const hasTools = messages.some(m =>
    m.content.includes('function') || m.content.includes('tool')
  );
  if (hasTools) {
    messages[0].content +=
      '\n\nYou can use tools by responding with JSON blocks like:\n' +
      '```tool\n{"name": "tool_name", "arguments": {...}}\n```\n' +
      'Execute one tool at a time and wait for the result before proceeding.';
  }

  try {
    const result = await service.generate({
      messages,
      maxTokens: req.maxTokens || 2048,
      temperature: req.temperature ?? 0.7,
      topP: 0.9,
      signal: req.signal,
      onToken: req.onStream ? (token: string) => req.onStream?.(token) : undefined,
    });

    return {
      text: result.text,
      provider: 'local-llm',
      model: modelId,
      finishReason: result.finishReason,
      wasTruncated: result.finishReason === 'length',
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { text: '', provider: 'local-llm', model: modelId, finishReason: 'error', wasTruncated: false };
    }
    logger.error('[callLocalLLM] Generation failed:', err);
    throw err;
  }
}
