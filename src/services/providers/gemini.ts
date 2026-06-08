import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import { useGiaStore } from '../../store/useGiaStore';
import { createStreamParser, processStreamChunk } from '../../utils/streamParser';
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
      currentParts.push({ inline_data: { mime_type: img.type, data: base64Data } });
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

    return new Promise<BrainResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fullText = '';
      let lastProcessed = 0;
      let processing = false;
      let pendingBuffer = '';
      const streamState = createStreamParser();
      const functionCallsAccum: { name: string; args: Record<string, unknown> }[] = [];
      let thoughtBuffer = '';

      const flushFunctionCalls = () => {
        if (functionCallsAccum.length === 0) return;
        for (const fc of functionCallsAccum) {
          fullText += `\`\`\`tool\n${JSON.stringify({ id: fc.name, args: fc.args })}\n\`\`\``;
        }
        functionCallsAccum.length = 0;
      };

      const flushThoughts = () => {
        if (thoughtBuffer) {
          req.onThought?.(thoughtBuffer);
          thoughtBuffer = '';
        }
      };

      xhr.open('POST', url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
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
            if (!t.startsWith('data: ')) continue;
            const jsonStr = t.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
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
                  const displayText = processStreamChunk(delta, streamState);
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
              }
            } catch (e) { logger.error('[gemini] Failed to parse streaming response chunk:', e); }
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
        flushFunctionCalls();
        flushThoughts();
        if (!fullText.trim()) reject(new Error('Gemini returned empty response'));
        else {
          const wasTruncated = finishReason === 'MAX_TOKENS';
          resolve({ text: fullText, provider: 'gemini', model: config.model, finishReason, wasTruncated });
        }
      };

      xhr.onerror = () => reject(new Error('Gemini network error'));
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
  return { text, provider: 'gemini', model: config.model, finishReason, wasTruncated };
}
