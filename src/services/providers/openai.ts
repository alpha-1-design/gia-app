import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { providerRegistry } from '../ProviderRegistry';
import { useGiaStore } from '../../store/useGiaStore';
import { corsProxy } from '../CorsProxy';
import type { BrainRequest, BrainResponse, BrainContext } from './types';
import { createStreamWatchdog, STREAM_IDLE_TIMEOUT_MS } from './streamWatchdog';
import { freeTier } from '../FreeTierService';

export async function callOpenAICompat(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const { activeProvider, providers } = useProviderStore.getState();
  const providerId = req.providerId || activeProvider;
  const config = providers[providerId];
  const definition = providerRegistry.getProvider(providerId);
  const effectiveModel = req.modelOverride || config.model;
  const baseUrl = (config.baseUrl || definition?.baseUrl || providerRegistry.getBaseUrl(providerId)).replace(/\/+$/, '');
  const label = providerRegistry.getLabel(providerId);
  if (!baseUrl) throw new Error(`Unknown provider: ${providerId}`);
  // Keyless free providers: enforce a client-side rate limit so the shared
  // tier stays usable. Over-limit throws a "rate limit" error, which the
  // failover layer treats as recoverable (fall back to another provider or retry).
  if (freeTier.isFreeTier(providerId)) {
    const decision = freeTier.check(providerId);
    if (!decision.allowed) {
      const wait = decision.retryAfterMs > 0 ? ` Try again in ${Math.ceil(decision.retryAfterMs / 1000)}s.` : '';
      const err = new Error(`${label} rate limit: ${decision.reason ?? 'the free tier is busy'}.${wait} Connect your own API key for unlimited use.`) as Error & { retryable?: boolean };
      err.retryable = false;
      throw err;
    }
    freeTier.record(providerId);
  }
  const messages = [
    { role: 'system', content: ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode) },
    ...(await ctx.buildMessages(req))
  ];
  const body: Record<string, unknown> = {
    model: effectiveModel,
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 2048,
    stream: !!req.onStream,
  };
  if (req.forceJson) {
    body.response_format = { type: 'json_object' };
  }
  if (useGiaStore.getState().handsOff && !req._skipNativeSchemas && !req.forceJson) {
    const tools = ctx.buildOpenAITools();
    body.tools = req.allowedToolIds
      ? tools.filter(tool => req.allowedToolIds?.includes((tool.function as { name: string }).name))
      : tools;
  }
  if (req.useExtendedThinking) {
    const modelLower = effectiveModel.toLowerCase();
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
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://gia.app';
    headers['X-Title'] = 'GIA';
  }

  if (req.onStream) {
    if (req.signal?.aborted) return { text: '', provider: providerId, model: effectiveModel };

    const runStream = (url: string) => new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
      let partialLine = '';
      const toolCallAccum: Map<number, { id?: string; name?: string; args: string }> = new Map();

      xhr.open('POST', url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.responseType = 'text';
      // Overall wall-clock ceiling only — a legitimately long answer can
      // exceed it while streaming fine. Stalls are caught by the idle watchdog
      // below, which measures time since the last byte.
      xhr.timeout = 120000;

      // Idle-stall guard. xhr.timeout can't fire here: it resets on nothing
      // and a provider that goes silent mid-answer (or dribbles keep-alive
      // bytes) never trips it, leaving the user watching a frozen reply.
      const stallMessage = () => `${label} stopped sending data for ${STREAM_IDLE_TIMEOUT_MS / 1000}s — the connection stalled. Try again or switch providers.`;
      const watchdog = createStreamWatchdog({
        onStall: () => {
          watchdog.stop();
          xhr.abort();
          reject(new Error(ctx.friendlyError(label, stallMessage())));
        },
        message: stallMessage,
      });

      let finishReason = '';
      let streamTokenUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

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

      const drain = () => {
        if (processing) return;
        processing = true;
        while (pendingBuffer) {
          const chunk = pendingBuffer;
          pendingBuffer = '';
          const combined = partialLine + chunk;
          partialLine = '';
          const lines = combined.split('\n');
          partialLine = lines.pop() || '';
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

                  if (json.usage) {
                    streamTokenUsage = json.usage;
                  }

                  const reasoningDelta = delta?.reasoning_content || delta?.reasoning || delta?.thought;
                  if (reasoningDelta) {
                    try { req.onThinkingDelta?.(reasoningDelta); } catch { /* ignore */ }
                  }

                  const textDelta = delta?.content || '';
                if (textDelta) {
                  fullText += textDelta;
                  try { req.onStream!(textDelta); } catch { /* ignore stream errors to keep processing flag */ }
                }
              } catch (e) { logger.error('[openai] Failed to parse streaming response chunk:', e); continue; }
            }
          }
        }
        processing = false;
        if (pendingBuffer) drain();
      };

      const onData = () => {
        // Any inbound bytes count as progress, even unparseable keep-alives.
        watchdog.poke();
        const currentLen = xhr.responseText.length;
        pendingBuffer += xhr.responseText.slice(lastProcessed);
        lastProcessed = currentLen;
        drain();
      };

      xhr.onprogress = onData;

      xhr.onload = () => {
        watchdog.stop();
        if (xhr.status >= 400) {
          if (xhr.status === 429) freeTier.markRateLimited(providerId);
          const preview = (xhr.responseText || '').slice(0, 200);
          const err = new Error(ctx.friendlyError(label, `${label} error ${xhr.status}: ${preview}`)) as Error & { retryable?: boolean };
          err.retryable = false;
          reject(err);
          return;
        }
        onData();
        if (partialLine.trim()) {
          const t = partialLine.trim();
          if (t.startsWith('data: ')) {
            try {
              const json = JSON.parse(t.slice(6));
              const delta = json.choices?.[0]?.delta;
              if (delta?.content) fullText += delta.content;
            } catch { /* ignore partial parse errors on close */ }
          }
        }
        flushToolCalls();
        if (!fullText.trim() && !req.signal?.aborted) {
          reject(new Error(`⚠️ ${label} returned empty response. The model may be overloaded. Try again or switch providers.`));
        } else {
          const wasTruncated = finishReason === 'length';
          const tokenUsage = streamTokenUsage ? { input: streamTokenUsage.prompt_tokens || 0, output: streamTokenUsage.completion_tokens || 0, total: streamTokenUsage.total_tokens || 0 } : undefined;
          resolve({ text: fullText, provider: providerId, model: effectiveModel, finishReason, wasTruncated, tokenUsage });
        }
      };

      xhr.onerror = () => {
        watchdog.stop();
        const err = new Error(ctx.friendlyError(label, `${label} network error`)) as Error & { retryable?: boolean };
        // Only safe to retry through the CORS proxy if no content reached the
        // user yet — this fires almost instantly for a blocked cross-origin
        // request, before any bytes arrive. If we'd already streamed partial
        // text and then lost the connection, retrying from scratch would
        // duplicate/corrupt what's already on screen, so we don't.
        err.retryable = fullText.length === 0 && lastProcessed === 0;
        reject(err);
      };
      xhr.ontimeout = () => {
        watchdog.stop();
        reject(new Error(ctx.friendlyError(label, `${label} timed out after 120s`)));
      };
      xhr.onabort = () => {
        watchdog.stop();
        const e = new Error('Request aborted');
        e.name = 'AbortError';
        reject(e);
      };

      if (req.signal) {
        if (req.signal.aborted) { watchdog.stop(); xhr.abort(); return; }
        const onAbort = () => { watchdog.stop(); xhr.abort(); };
        req.signal.addEventListener('abort', onAbort);
        const origLoad = xhr.onload;
        const origError = xhr.onerror;
        const origAbort = xhr.onabort;
        xhr.onload = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          watchdog.stop();
          req.signal?.removeEventListener('abort', onAbort);
          if (origLoad) (origLoad as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
        xhr.onerror = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          watchdog.stop();
          req.signal?.removeEventListener('abort', onAbort);
          if (origError) (origError as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
        xhr.onabort = function (this: XMLHttpRequest, e: ProgressEvent<EventTarget>) {
          watchdog.stop();
          req.signal?.removeEventListener('abort', onAbort);
          if (origAbort) (origAbort as (e: ProgressEvent<EventTarget>) => void).call(this, e);
        };
      }

      xhr.send(JSON.stringify(body));
    });

    try {
      return await runStream(`${baseUrl}/chat/completions`);
    } catch (e) {
      const err = e as Error & { retryable?: boolean };
      if (err.name === 'AbortError' || !err.retryable) throw err;
      logger.warn('[openai] Direct streaming request failed, retrying via CORS proxy:', err.message);
      return await runStream(corsProxy.proxyUrl(`${baseUrl}/chat/completions`));
    }
  }

  const attemptFetch = async (url: string): Promise<Response> => {
    try {
      return await ctx.retryFetch(url, {
        method: 'POST', headers, body: JSON.stringify(body), signal: req.signal,
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw e;
      throw new Error(ctx.friendlyError(label, e));
    }
  };

  let res: Response;
  let usedProxy = false;
  try {
    res = await attemptFetch(`${baseUrl}/chat/completions`);
  } catch (e) {
    // A CORS / network error makes fetch throw rather than return a non-ok
    // response, so it never reaches the proxy retry below. Retry through the
    // CORS proxy here — the streaming path already does this; non-streaming
    // must too or forceJson/collaborative/image-gen never reach the provider.
    logger.warn('[openai] Direct fetch failed, trying CORS proxy:', (e as Error).message);
    res = await attemptFetch(corsProxy.proxyUrl(`${baseUrl}/chat/completions`));
    usedProxy = true;
  }
  if (!res.ok && !usedProxy && res.status !== 429) {
    const errMsg = `${label} error ${res.status}: ${await res.text().catch(() => '')}`;
    logger.warn('[openai] Direct fetch failed, trying CORS proxy:', errMsg);
    const proxiedUrl = corsProxy.proxyUrl(`${baseUrl}/chat/completions`);
    res = await attemptFetch(proxiedUrl);
  }
  if (!res.ok) {
    if (res.status === 429) freeTier.markRateLimited(providerId);
    const e: { error?: { message?: string } } = await res.json().catch(() => ({}));
    throw new Error(ctx.friendlyError(label, e?.error?.message || `${label} error ${res.status}`));
  }
  const data = await res.json();
  const tokenUsage = data.usage ? {
    input: data.usage.prompt_tokens || 0,
    output: data.usage.completion_tokens || 0,
    total: data.usage.total_tokens || 0,
  } : undefined;
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
  return { text: content, provider: providerId, model: effectiveModel, finishReason, wasTruncated, tokenUsage };
}
