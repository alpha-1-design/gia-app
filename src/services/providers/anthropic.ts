import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';
import type { BrainRequest, BrainResponse, BrainContext } from './types';

export async function callAnthropic(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const { providers } = useProviderStore.getState();
  const config = providers.anthropic;
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
    model: config.model,
    max_tokens: useThinking ? 16000 : (req.maxTokens ?? 2048),
    system: ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode),
    messages,
    stream: !!req.onStream,
  };
  if (useGiaStore.getState().handsOff && !req._skipNativeSchemas && !req.forceJson) {
    body.tools = ctx.buildAnthropicTools();
  }
  if (!useThinking && req.temperature !== undefined) body.temperature = req.temperature;
  if (useThinking) body.thinking = { type: 'enabled', budget_tokens: 10000 };
  const anthropicHeaders: Record<string, string> = {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'Content-Type': 'application/json',
  };

  if (req.onStream) {
    if (req.signal?.aborted) return { text: '', provider: 'anthropic', model: config.model };

    let finishReason = '';

    return new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
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

      xhr.open('POST', 'https://api.anthropic.com/v1/messages');
      Object.entries(anthropicHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.responseType = 'text';

      const drain = () => {
        if (processing) return;
        processing = true;
        while (pendingBuffer) {
          const chunk = pendingBuffer;
          pendingBuffer = '';
          const events = chunk.split('\n\n');
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
                  req.onStream!(text);
                }
                if (delta?.type === 'thinking_delta') {
                  req.onThought?.(delta.thinking ?? '');
                }
                if (delta?.type === 'input_json_delta') {
                  const existing = toolUseBlocks.get(parsed.index);
                  if (existing) {
                    existing.input += delta.partial_json ?? '';
                  }
                }
              }
              if (parsed.type === 'message_stop' && parsed.stop_reason) {
                finishReason = parsed.stop_reason;
              }
            } catch (e) { logger.error('[anthropic] Failed to parse streaming response chunk:', e); }
          }
        }
        processing = false;
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
        flushToolUses();
        if (!fullText.trim()) reject(new Error('Anthropic returned empty response'));
        else {
          const wasTruncated = finishReason === 'max_tokens';
          resolve({ text: fullText, provider: 'anthropic', model: config.model, finishReason, wasTruncated });
        }
      };

      xhr.onerror = () => reject(new Error('Anthropic network error'));
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
  }

  const res = await ctx.retryFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: anthropicHeaders,
    body: JSON.stringify(body), signal: req.signal,
  }).catch((e: { name?: string }) => {
    if (e.name === 'AbortError') throw e;
    throw new Error(ctx.friendlyError('Anthropic', e));
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(ctx.friendlyError('Anthropic', e?.error?.message || `Anthropic error ${res.status}`));
  }
  const data: { content?: { type: string; text?: string; name?: string; input?: unknown }[]; stop_reason?: string } = await res.json();
  const blocks = data.content || [];
  let text = blocks.find(b => b.type === 'text')?.text ?? '';
  const toolUses = blocks.filter(b => b.type === 'tool_use');
  for (const tu of toolUses) {
    text += `\n\`\`\`tool\n${JSON.stringify({ id: tu.name, args: tu.input })}\n\`\`\`\n`;
  }
  if (!text.trim()) throw new Error(ctx.friendlyError('Anthropic', 'Anthropic returned empty response'));
  const finishReason = data.stop_reason || 'stop';
  const wasTruncated = finishReason === 'max_tokens';
  return { text, provider: 'anthropic', model: config.model, finishReason, wasTruncated };
}
