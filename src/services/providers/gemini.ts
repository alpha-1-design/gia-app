import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';
import type { BrainRequest, BrainResponse, BrainContext } from './types';

export async function callGeminiNative(req: BrainRequest, ctx: BrainContext): Promise<BrainResponse> {
  const { providers } = useProviderStore.getState();
  const config = providers.gemini;

  const contents: { role: string; parts: { text: string }[] }[] = [];
  if (req.history) {
    req.history.forEach(m => {
      const part = typeof m.content === 'string' ? { text: m.content } : { text: JSON.stringify(m.content) };
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [part] });
    });
  }

  const currentParts: { text: string }[] = [{ text: req.prompt }];
  if (req.images) {
    req.images.forEach(img => {
      const base64Data = img.data.split(',')[1] || img.data;
      currentParts.push({ inline_data: { mime_type: img.type, data: base64Data } } as unknown as { text: string });
    });
  }
  contents.push({ role: 'user', parts: currentParts });

  const body: Record<string, unknown> = {
    contents,
    system_instruction: { parts: [{ text: ctx.buildSystemPrompt(req.prompt, req.systemPrompt, req.systemPromptMode) }] },
    generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 2048 }
  };
  if (useGiaStore.getState().handsOff && !req._skipNativeSchemas && !req.forceJson) {
    body.tools = [{ function_declarations: ctx.buildGeminiTools() }];
  }
  if (req.useExtendedThinking) {
    (body.generationConfig as { temperature?: number }).temperature = undefined;
  }
  if (req.onStream) {
    if (req.signal?.aborted) return { text: '', provider: 'gemini', model: config.model };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
    const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };

    let finishReason = '';
    let streamTokenUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;

    return new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
      let partialEvent = '';
      const functionCallsAccum: { name: string; args: Record<string, unknown> }[] = [];

      const flushFunctionCalls = () => {
        if (functionCallsAccum.length === 0) return;
        for (const fc of functionCallsAccum) {
          fullText += `\`\`\`tool\n${JSON.stringify({ id: fc.name, args: fc.args })}\n\`\`\``;
        }
        functionCallsAccum.length = 0;
      };

      xhr.open('POST', url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
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
            if (!t.startsWith('data: ')) continue;
            const jsonStr = t.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.usageMetadata) {
                streamTokenUsage = parsed.usageMetadata;
              }
              const candidate = parsed.candidates?.[0];
              if (candidate?.finishReason) {
                finishReason = candidate.finishReason;
              }
              const parts = candidate?.content?.parts || [];
              for (const part of parts) {
                if (part.functionCall) {
                  functionCallsAccum.push({
                    name: part.functionCall.name,
                    args: part.functionCall.args || {},
                  });
                  continue;
                }
                if (part?.text) {
                  const delta = part.text;
                  fullText += delta;
                  try { req.onStream!(delta); } catch { /* ignore stream errors */ }
                }
              }
            } catch (e) { logger.error('[gemini] Failed to parse streaming response chunk:', e); }
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
          if (t.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(t.slice(6).trim());
              const parts = parsed.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part?.text) fullText += part.text;
              }
            } catch { /* ignore */ }
          }
        }
        flushFunctionCalls();
        if (!fullText.trim()) reject(new Error('Gemini returned empty response'));
        else {
          const wasTruncated = finishReason === 'MAX_TOKENS';
          const tokenUsage = streamTokenUsage ? { input: streamTokenUsage.promptTokenCount || 0, output: streamTokenUsage.candidatesTokenCount || 0, total: streamTokenUsage.totalTokenCount || 0 } : undefined;
          resolve({ text: fullText, provider: 'gemini', model: config.model, finishReason, wasTruncated, tokenUsage });
        }
      };

      xhr.onerror = () => reject(new Error('Gemini network error'));
      xhr.ontimeout = () => reject(new Error('Gemini timed out after 120s'));
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
          if (origLoad) origLoad.call(this, e as unknown as ProgressEvent<EventTarget>);
        };
        xhr.onerror = function (this: XMLHttpRequest, e: Event) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origError) origError.call(this, e as unknown as ProgressEvent<EventTarget>);
        };
        xhr.onabort = function (this: XMLHttpRequest, e: Event) {
          req.signal?.removeEventListener('abort', onAbort);
          if (origAbort) origAbort.call(this, e as unknown as ProgressEvent<EventTarget>);
        };
      }

      xhr.send(JSON.stringify(body));
    });
  }

  const res = await ctx.retryFetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: JSON.stringify(body),
    signal: req.signal,
  }).catch((e: { name?: string }) => {
    if (e.name === 'AbortError') throw e;
    throw new Error(ctx.friendlyError('Gemini', e));
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(ctx.friendlyError('Gemini', e?.error?.message || `Gemini error ${res.status}`));
  }
  const data = await res.json();
  const tokenUsage = data.usageMetadata ? { input: data.usageMetadata.promptTokenCount || 0, output: data.usageMetadata.candidatesTokenCount || 0, total: data.usageMetadata.totalTokenCount || 0 } : undefined;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  let text = parts.find((p: { text?: string }) => p.text)?.text || '';
  const functionCalls = parts.filter((p: { functionCall?: { name: string; args: Record<string, unknown> } }) => p.functionCall);
  for (const fc of functionCalls) {
    text += `\n\`\`\`tool\n${JSON.stringify({ id: fc.functionCall.name, args: fc.functionCall.args })}\n\`\`\`\n`;
  }
  if (!text.trim()) throw new Error(ctx.friendlyError('Gemini', 'Gemini returned empty response'));
  const finishReason = candidate?.finishReason || 'STOP';
  const wasTruncated = finishReason === 'MAX_TOKENS';
  return { text, provider: 'gemini', model: config.model, finishReason, wasTruncated, tokenUsage };
}
