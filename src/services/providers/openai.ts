import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { providerRegistry } from '../ProviderRegistry';
import { useGiaStore } from '../../store/useGiaStore';
import { corsProxy } from '../CorsProxy';
import { createStreamParser, processStreamChunk } from '../../utils/streamParser';
import type { BrainRequest, BrainResponse, BrainContext } from './types';

export async function callOpenAICompat(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const { activeProvider, providers } = useProviderStore.getState();
  const config = providers[activeProvider];
  const baseUrl = providerRegistry.getBaseUrl(activeProvider);
  const label = providerRegistry.getLabel(activeProvider);
  if (!baseUrl) throw new Error(`Unknown provider: ${activeProvider}`);
  const messages = [
    { role: 'system', content: ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode) },
    ...(await ctx.buildMessages(req))
  ];
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 2048,
    stream: !!req.onStream,
  };
  if (req.forceJson) {
    body.response_format = { type: 'json_object' };
  }
  if (useGiaStore.getState().handsOff && !req._skipNativeSchemas && !req.forceJson) {
    body.tools = ctx.buildOpenAITools();
  }
  if (req.useExtendedThinking) {
    const modelLower = config.model.toLowerCase();
    if (modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('o4')) {
      body.reasoning_effort = 'high';
    } else {
      body.temperature = undefined;
    }
  }
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (activeProvider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://gia.app';
    headers['X-Title'] = 'GIA';
  }

  if (req.onStream) {
    if (req.signal?.aborted) return { text: '', provider: activeProvider, model: config.model };

    return new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
      const streamState = createStreamParser();
      const toolCallAccum: Map<number, { id?: string; name?: string; args: string }> = new Map();
      let thoughtBuffer = '';

      xhr.open('POST', `${baseUrl}/chat/completions`);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.responseType = 'text';

      let finishReason = '';

      const flushToolCalls = () => {
        if (toolCallAccum.size === 0) return;
        for (const [, tc] of toolCallAccum) {
          if (!tc.name) continue;
          try {
            const args = JSON.parse(tc.args);
            const toolBlock = `\`\`\`tool\n${JSON.stringify({ id: tc.name, args })}\n\`\`\``;
            fullText += toolBlock;
          } catch (e) { logger.error('GIA: failed to parse tool args', e); }
        }
        toolCallAccum.clear();
      };

      const flushThoughts = () => {
        if (thoughtBuffer) {
          req.onThought?.(thoughtBuffer);
          thoughtBuffer = '';
        }
      };

      const drain = () => {
        if (processing) return;
        processing = true;
        while (pendingBuffer) {
          const chunk = pendingBuffer;
          pendingBuffer = '';
          const lines = chunk.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t || t === 'data: [DONE]') continue;
            if (t.startsWith('data: ')) {
              try {
                const json = JSON.parse(t.slice(6));
                const choice = json.choices?.[0];
                const delta = choice?.delta;

                if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    if (!tc.function) continue;
                    const idx = tc.index ?? 0;
                    if (!toolCallAccum.has(idx)) {
                      toolCallAccum.set(idx, {
                        id: tc.id,
                        name: tc.function?.name,
                        args: tc.function?.arguments || '',
                      });
                    } else {
                      const existing = toolCallAccum.get(idx)!;
                      if (tc.id) existing.id = tc.id;
                      if (tc.function?.name) existing.name = tc.function.name;
                      if (tc.function?.arguments) existing.args += tc.function.arguments;
                    }
                  }
                  continue;
                }

                if (choice?.finish_reason) {
                  finishReason = choice.finish_reason;
                }

                if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls) {
                  for (const tc of choice.message.tool_calls) {
                    if (tc.type === 'function') {
                      try {
                        const args = typeof tc.function.arguments === 'string'
                          ? JSON.parse(tc.function.arguments)
                          : tc.function.arguments;
                        fullText += `\`\`\`tool\n${JSON.stringify({ id: tc.function.name, args })}\n\`\`\``;
                      } catch (e) { logger.error('GIA: failed to parse native tool call', e); }
                    }
                  }
                  continue;
                }

                const textDelta = delta?.content || '';
                if (textDelta) {
                  fullText += textDelta;
                  const displayText = processStreamChunk(textDelta, streamState);
                  if (streamState.thoughtsAccumulated) {
                    const newThoughts = streamState.thoughtsAccumulated;
                    streamState.thoughtsAccumulated = '';
                    thoughtBuffer += newThoughts;
                    flushThoughts();
                  }
                  if (displayText) {
                    req.onStream!(displayText);
                  }
                }
              } catch (e) { logger.error('[openai] Failed to parse streaming response chunk:', e); continue; }
            }
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
        flushToolCalls();
        flushThoughts();
        if (!fullText.trim() && !req.signal?.aborted) {
          reject(new Error(`⚠️ ${label} returned empty response. The model may be overloaded. Try again or switch providers.`));
        } else {
          const wasTruncated = finishReason === 'length';
          resolve({ text: fullText, provider: activeProvider, model: config.model, finishReason, wasTruncated });
        }
      };

      xhr.onerror = () => reject(new Error(ctx.friendlyError(label, `${label} network error`)));
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
        xhr.onload = function (this: XMLHttpRequest, e: Event) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origLoad) origLoad.call(this, e);
        };
        xhr.onerror = function (this: XMLHttpRequest, e: Event) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origError) origError.call(this, e);
        };
        xhr.onabort = function (this: XMLHttpRequest, e: Event) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origAbort) origAbort.call(this, e);
        };
      }

      xhr.send(JSON.stringify(body));
    });
  }

  const attemptFetch = async (url: string) => ctx.retryFetch(url, {
    method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
  }).catch((e: { name?: string }) => {
    if (e.name === 'AbortError') throw e;
    throw new Error(ctx.friendlyError(label, e));
  });

  let res = await attemptFetch(`${baseUrl}/chat/completions`);
  if (!res.ok) {
    const errMsg = `${label} error ${res.status}: ${await res.text().catch(() => '')}`;
    logger.warn('[openai] Direct fetch failed, trying CORS proxy:', errMsg);
    const proxiedUrl = corsProxy.proxyUrl(`${baseUrl}/chat/completions`);
    res = await attemptFetch(proxiedUrl);
  }
  if (!res.ok) {
    const e: { error?: { message?: string } } = await res.json().catch(() => ({}));
    throw new Error(ctx.friendlyError(label, e?.error?.message || `${label} error ${res.status}`));
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  let content = choice?.message?.content || '';
  const toolCalls = choice?.message?.tool_calls;
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      if (tc.type === 'function') {
        try {
          const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          content += `\n\`\`\`tool\n${JSON.stringify({ id: tc.function.name, args })}\n\`\`\`\n`;
        } catch (e) { logger.error('GIA: failed to parse function args', e); }
      }
    }
  }
  if (!content?.trim()) throw new Error(ctx.friendlyError(label, `${label} returned empty response`));
  const finishReason = choice?.finish_reason || 'stop';
  const wasTruncated = finishReason === 'length';
  return { text: content, provider: activeProvider, model: config.model, finishReason, wasTruncated };
}
