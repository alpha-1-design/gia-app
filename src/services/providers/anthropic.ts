import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { providerRegistry } from '../ProviderRegistry';
import { corsProxy } from '../CorsProxy';
import { useGiaStore } from '../../store/useGiaStore';
import type { BrainRequest, BrainResponse, BrainContext } from './types';

export async function callAnthropic(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const { providers } = useProviderStore.getState();
  const config = providers.anthropic;
  const effectiveModel = req.modelOverride || config.model;
  const useThinking = !!req.useExtendedThinking;

  const messages = (await ctx.buildMessages(req)).map(m => {
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((c: { type: string; image_url?: { url?: string } }) => {
          if (c.type === 'image_url') {
            try {
              const url = c.image_url?.url ?? '';
              const match = url.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.*)$/);
              if (match) {
                return {
                  type: 'image',
                  source: { type: 'base64', media_type: match[1], data: match[3] }
                };
              }
            } catch (e) { logger.error(e); }
            throw new Error(`Unsupported image format for Anthropic. Supported: JPEG, PNG, GIF, WebP. Got: ${c.image_url?.url?.slice(0, 50) || 'unknown'}`);
          }
          return c;
        })
      };
    }
    return m;
  });

  const body: Record<string, unknown> = {
    model: effectiveModel,
    max_tokens: useThinking ? 16000 : (req.maxTokens ?? 2048),
    system: ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode),
    messages,
    stream: !!req.onStream,
  };
  const enableTools = useGiaStore.getState().handsOff && !req._skipNativeSchemas && !req.forceJson;
  if (enableTools) {
    body.tools = ctx.buildAnthropicTools();
  }
  if (req.forceJson) {
    body.stop_sequences = ["\n```\n"];
  }
  if (!useThinking && req.temperature !== undefined) body.temperature = req.temperature;
  // Anthropic rejects `tools` + `thinking` together on many versions/accounts
  // (hard 400). When native tools are needed we keep them and drop thinking.
  if (useThinking && !enableTools) body.thinking = { type: 'enabled', budget_tokens: 10000 };
  const baseUrl = providerRegistry.getBaseUrl('anthropic') || 'https://api.anthropic.com/v1';
  const anthropicHeaders: Record<string, string> = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'Content-Type': 'application/json',
  };

  if (req.onStream) {
    if (req.signal?.aborted) return { text: '', provider: 'anthropic', model: effectiveModel };

    let finishReason = '';
    let streamTokenUsage: { input_tokens: number; output_tokens: number } | undefined;

    const runStream = (streamUrl: string) => new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
      let partialEvent = '';
      const toolUseBlocks: Map<number, { id: string; name: string; input: string }> = new Map();

      const flushToolUses = () => {
        if (toolUseBlocks.size === 0) return;
        for (const [, block] of toolUseBlocks) {
          try {
            const args = JSON.parse(block.input);
            fullText += `\n\`\`\`tool\n${JSON.stringify({ id: block.name, args })}\n\`\`\`\n`;
          } catch (e) { logger.error('GIA: failed to parse tool use input', e); }
        }
        toolUseBlocks.clear();
      };

      xhr.open('POST', streamUrl);
      Object.entries(anthropicHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.responseType = 'text';
      xhr.timeout = 120000;

      const drain = () => {
        if (processing) return;
        processing = true;
        while (pendingBuffer) {
          const chunk = pendingBuffer;
          pendingBuffer = '';
          const combined = partialEvent + chunk;
          partialEvent = '';
          const events = combined.split('\n\n');
          partialEvent = events.pop() || '';
          for (const event of events) {
            const t = event.trim();
            if (!t.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(t.slice(5).trim());
              if (parsed.type === 'content_block_start') {
                const block = parsed.content_block;
                if (block?.type === 'thinking') {
                  if (block.thinking) {
                    req.onThought?.(block.thinking);
                  }
                }
                if (block?.type === 'tool_use') {
                  toolUseBlocks.set(parsed.index, {
                    id: block.id,
                    name: block.name,
                    input: '',
                  });
                }
              }
              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta;
                if (delta?.type === 'text_delta') {
                  const text = delta.text ?? '';
                  fullText += text;
                  try { req.onStream!(text); } catch { /* ignore stream errors */ }
                }
                if (delta?.type === 'thinking_delta') {
                  try { req.onThought?.(delta.thinking ?? ''); } catch { /* ignore */ }
                }
                if (delta?.type === 'input_json_delta') {
                  const existing = toolUseBlocks.get(parsed.index);
                  if (existing) {
                    existing.input += delta.partial_json ?? '';
                  }
                }
              }
              if (parsed.type === 'message_start' && parsed.message?.usage) {
                streamTokenUsage = { ...parsed.message.usage };
              }
              if (parsed.type === 'message_delta' && parsed.usage) {
                streamTokenUsage = { ...streamTokenUsage, ...parsed.usage };
              }
              if (parsed.type === 'message_stop' && parsed.stop_reason) {
                finishReason = parsed.stop_reason;
              }
            } catch (e) { logger.error('[anthropic] Failed to parse streaming response chunk:', e); }
          }
        }
        processing = false;
        if (pendingBuffer) drain();
      };

      const onData = () => {
        const currentLen = xhr.responseText.length;
        pendingBuffer += xhr.responseText.slice(lastProcessed);
        lastProcessed = currentLen;
        drain();
      };

      xhr.onprogress = onData;

      xhr.onload = () => {
        onData();
        if (partialEvent.trim()) {
          const t = partialEvent.trim();
          if (t.startsWith('data:')) {
            try {
              const parsed = JSON.parse(t.slice(5).trim());
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  fullText += parsed.delta.text ?? '';
                }
              }
            } catch { /* ignore */ }
          }
        }
        flushToolUses();
        if (!fullText.trim()) reject(new Error('Anthropic returned empty response'));
        else {
          const wasTruncated = finishReason === 'max_tokens';
          const tokenUsage = streamTokenUsage ? { input: streamTokenUsage.input_tokens || 0, output: streamTokenUsage.output_tokens || 0, total: (streamTokenUsage.input_tokens || 0) + (streamTokenUsage.output_tokens || 0) } : undefined;
          resolve({ text: fullText, provider: 'anthropic', model: effectiveModel, finishReason, wasTruncated, tokenUsage });
        }
      };

      xhr.onerror = () => {
        const err = new Error('Anthropic network error') as Error & { retryable?: boolean };
        err.retryable = fullText.length === 0 && lastProcessed === 0;
        reject(err);
      };
      xhr.ontimeout = () => reject(new Error('Anthropic timed out after 120s'));
      xhr.onabort = () => {
        const e = new Error('Request aborted');
        e.name = 'AbortError';
        reject(e);
      };

      if (req.signal) {
        if (req.signal.aborted) { xhr.abort(); return; }
        const onAbort = () => xhr.abort();
        req.signal.addEventListener('abort', onAbort);
        const origLoad = xhr.onload;
        const origError = xhr.onerror;
        const origAbort = xhr.onabort;
        xhr.onload = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origLoad) (origLoad as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
        xhr.onerror = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origError) (origError as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
        xhr.onabort = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origAbort) (origAbort as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
      }

      xhr.send(JSON.stringify(body));
    });

    try {
      return await runStream(`${baseUrl}/messages`);
    } catch (e) {
      const err = e as Error & { retryable?: boolean };
      if (err.name === 'AbortError' || !err.retryable) throw err;
      logger.warn('[anthropic] Direct streaming request failed, retrying via CORS proxy:', err.message);
      return await runStream(corsProxy.proxyUrl(`${baseUrl}/messages`));
    }
  }

  const doRequest = async (url: string): Promise<Response> => {
    try {
      return await ctx.retryFetch(url, {
        method: 'POST', headers: anthropicHeaders, body: JSON.stringify(body), signal: req.signal,
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw e;
      throw new Error(ctx.friendlyError('Anthropic', e));
    }
  };

  let res: Response;
  let usedProxy = false;
  try {
    res = await doRequest(`${baseUrl}/messages`);
  } catch (e) {
    // CORS / network errors throw instead of returning a non-ok response, so
    // retry through the CORS proxy here (mirrors the OpenAI-compat path).
    logger.warn('[anthropic] Direct fetch failed, trying CORS proxy:', (e as Error).message);
    res = await doRequest(corsProxy.proxyUrl(`${baseUrl}/messages`));
    usedProxy = true;
  }
  if (!res.ok && !usedProxy) {
    res = await doRequest(corsProxy.proxyUrl(`${baseUrl}/messages`));
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(ctx.friendlyError('Anthropic', e?.error?.message || `Anthropic error ${res.status}`, res.status));
  }
  const data: { content?: { type: string; text?: string; name?: string; input?: unknown }[]; stop_reason?: string; usage?: { input_tokens: number; output_tokens: number } } = await res.json();
  const tokenUsage = data.usage ? { input: data.usage.input_tokens || 0, output: data.usage.output_tokens || 0, total: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) } : undefined;
  const blocks = data.content || [];
  let text = blocks.find(b => b.type === 'text')?.text ?? '';
  const toolUses = blocks.filter(b => b.type === 'tool_use');
  for (const tu of toolUses) {
    text += `\n\`\`\`tool\n${JSON.stringify({ id: tu.name, args: tu.input })}\n\`\`\`\n`;
  }
  if (!text.trim()) throw new Error(ctx.friendlyError('Anthropic', 'Anthropic returned empty response'));
  const finishReason = data.stop_reason || 'stop';
  const wasTruncated = finishReason === 'max_tokens';
  return { text, provider: 'anthropic', model: effectiveModel, finishReason, wasTruncated, tokenUsage };
}
