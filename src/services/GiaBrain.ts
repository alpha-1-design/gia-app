import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import type { BrainRequest, BrainResponse } from './providers/types';
import { callOpenAICompat } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGeminiNative } from './providers/gemini';
import { callLocalLLM } from './providers/local';
import LocalLLMServiceInstance from './LocalLLMService';
import { buildGiaSystem, setSystemContext } from './buildGiaSystem';
import { buildMessages, selectBestModel } from './brain/modelUtils';
import { buildOpenAITools, buildAnthropicTools, buildGeminiTools } from './brain/toolSchemas';
import { executeToolBlocks } from './brain/toolRunner';
import { extractMemories } from './brain/memoryExtractor';
import { retryFetch, friendlyError } from './brain/network';
import {
  saveCheckpoint, clearCheckpoint,
  isRateLimitOrQuotaError, isRetryableServerError,
} from './brain/ResilientRelay';
import PluginManager from './PluginManager';
import { isVisionCapable as _isVisionCapable } from './brain/modelUtils';
import ResponseCache from './ResponseCache';
import ProviderMonitor from './ProviderMonitor';
import OutputValidator from './OutputValidator';
import AnalyticsTracker from './AnalyticsTracker';
export { setSystemContext };

export type { BrainRequest, BrainResponse } from './providers/types';

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }
  static isVisionCapable(model: string, provider: string): boolean { return _isVisionCapable(model, provider); }

  private buildSystemPrompt(prompt: string, moduleSpecific?: string, mode: 'append' | 'replace' = 'append'): string {
    if (mode === 'replace' && moduleSpecific) return moduleSpecific;
    const base = buildGiaSystem(prompt);
    if (!moduleSpecific) return base;
    return `${base}\n\n## Module-Specific Instructions\n${moduleSpecific}`;
  }

  private async callProvider(req: BrainRequest, overrideProvider?: string): Promise<BrainResponse> {
    const providerId = overrideProvider ?? useProviderStore.getState().activeProvider;
    const ctx: import('./providers/types').BrainContext = {
      buildSystemPrompt: (p, m, mode) => this.buildSystemPrompt(p, m, mode),
      buildMessages: buildMessages as import('./providers/types').BrainContext['buildMessages'],
      buildOpenAITools: (() => buildOpenAITools() as unknown as ReturnType<import('./providers/types').BrainContext['buildOpenAITools']>) as unknown as import('./providers/types').BrainContext['buildOpenAITools'],
      buildAnthropicTools: (() => buildAnthropicTools() as unknown as ReturnType<import('./providers/types').BrainContext['buildAnthropicTools']>) as unknown as import('./providers/types').BrainContext['buildAnthropicTools'],
      buildGeminiTools: (() => buildGeminiTools() as unknown as ReturnType<import('./providers/types').BrainContext['buildGeminiTools']>) as unknown as import('./providers/types').BrainContext['buildGeminiTools'],
      retryFetch, friendlyError,
    };
    if (providerId === 'anthropic') {
      return callAnthropic(req, ctx);
    }
    if (providerId === 'gemini') {
      return callGeminiNative(req, ctx);
    }
    if (providerId === 'local-llm') {
      return callLocalLLM(req, ctx);
    }
    return callOpenAICompat(req, ctx);
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const state = useGiaStore.getState();

    // Resolve effective provider: req.providerId > global activeProvider > best available
    let resolvedId = (() => {
      if (req.providerId && providers[req.providerId]?.enabled && providers[req.providerId]?.apiKey) {
        return req.providerId;
      }
      if (req.providerId && req.providerId !== activeProvider) {
        // Specified provider isn't active — try best available
        const best = useProviderStore.getState().getBestProviderForTask();
        if (best) return best.id;
      }
      if (providers[activeProvider]?.enabled && providers[activeProvider]?.apiKey) {
        return activeProvider;
      }
      const best = useProviderStore.getState().getBestProviderForTask();
      return best?.id || activeProvider;
    })();

    // On-Device Mode: prefer the local LLM when it's actually loaded, so the
    // whole conversation runs on-device. Falls back to the user's provider
    // (shown as "cloud" on the response) when the local model isn't ready.
    if (state.onDeviceMode) {
      const localReady = Object.values(LocalLLMServiceInstance.getStatus()).some(
        (s) => s.status === 'ready'
      );
      if (localReady && resolvedId !== 'local-llm') {
        resolvedId = 'local-llm';
      }
    }

    const config = providers[resolvedId];
    if (resolvedId !== 'local-llm' && (!config || !config.enabled || !config.apiKey)) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    const effectiveProvider = resolvedId;
    const effectiveModel = config.model;

    // ── ResponseCache: check for cached response ──────────────
    if (state.responseCache && !req.onStream) {
      const cached = ResponseCache.get({
        prompt: req.prompt,
        model: effectiveModel,
        provider: effectiveProvider,
        systemPrompt: req.systemPrompt,
      });
      if (cached) {
        logger.log('[GiaBrain] Cache hit');
        return { text: cached, provider: effectiveProvider, model: effectiveModel };
      }
    }

    // Auto-select best model for this request's feature needs
    // Skip vision-based model switching when local vision is enabled
    const needsVision = req.localVision ? false : !!(req.images && req.images.length > 0);
    const selection = selectBestModel(effectiveProvider, req.modelOverride || config.model, needsVision);
    const finalModel = selection.model;
    if (selection.switched && !req.modelOverride) {
      useProviderStore.getState().setProviderModel(effectiveProvider, finalModel);
      useGiaStore.getState().addNotification(selection.reason || `Switched to ${finalModel}`);
    }

    // Run plugin beforeGenerate hooks
    let currentPrompt = await PluginManager.runBeforeGenerate(req.prompt);
    const history = req.history ? [...req.history] : [];
    let iterations = 0;
    const maxIterations = 10;
    let clarificationAttempts = 0;
    const sourcesAcc: string[] = [];
    const genStartTime = performance.now();

    if (req.forceJson) {
      req.systemPrompt = (req.systemPrompt || '') + '\n\nCRITICAL: You MUST respond with ONLY valid JSON. No markdown fences, no code blocks, no explanations, no text before or after the JSON. The entire response must be parseable by JSON.parse(). Start directly with { or [ and end with } or ]. Do NOT use any tools or call any functions.';
      if (effectiveProvider === 'anthropic') {
        req.systemPrompt += '\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanation. Just the raw JSON object.';
      }
      req.temperature = 0.1;
    }

    // Calibrate temperature based on prompt type (after forceJson override)
    const finalTemp = (() => {
      if (req.temperature !== undefined) return req.temperature;
      const lower = req.prompt.toLowerCase();
      if (lower.startsWith('write') || lower.startsWith('draft') || lower.startsWith('compose') || lower.startsWith('create')) return 0.9;
      if (lower.startsWith('summarize') || lower.startsWith('explain') || lower.startsWith('what is') || lower.startsWith('how')) return 0.3;
      if (lower.startsWith('fix') || lower.startsWith('debug') || lower.startsWith('refactor') || lower.startsWith('review')) return 0.2;
      if (lower.startsWith('translate')) return 0.5;
      return 0.7;
    })();
    const loopReq: BrainRequest = { ...req, temperature: finalTemp };

    let carryOverText = ''; // text already streamed to the user across failed attempts this turn

    while (iterations < maxIterations) {
      if (req.signal?.aborted) {
        const e = new Error('Request aborted');
        e.name = 'AbortError';
        throw e;
      }
      iterations++;
      loopReq.prompt = currentPrompt;
      loopReq.history = history;

      // Capture everything streamed THIS attempt so a mid-stream failure
      // doesn't discard tokens the user already saw — they get folded into
      // the continuation prompt for whichever provider picks up next.
      let attemptStreamed = '';
      const userOnStream = req.onStream;
      if (userOnStream) {
        loopReq.onStream = (chunk: string) => { attemptStreamed += chunk; userOnStream(chunk); };
      }

      const callStart = performance.now();
      let res: BrainResponse | undefined;

      try {
        res = await this.callProvider(loopReq, effectiveProvider);
        ProviderMonitor.recordSuccess(effectiveProvider, finalModel, Math.round(performance.now() - callStart));
        if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
        carryOverText = '';
      } catch (e: unknown) {
        const origError = e as Error;
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        ProviderMonitor.recordFailure(effectiveProvider, finalModel, msg, Math.round(performance.now() - callStart));

        // Retry once without native tool schemas (not a rate-limit issue — a schema/format issue)
        if (!loopReq._skipNativeSchemas && (
          msg.includes('tools') || msg.includes('tool') ||
          msg.includes('function') || msg.includes('functions') ||
          msg.includes('400') || msg.includes('bad request')
        )) {
          loopReq._skipNativeSchemas = true;
          try {
            res = await this.callProvider(loopReq, effectiveProvider);
            if (res) ProviderMonitor.recordSuccess(effectiveProvider, finalModel, Math.round(performance.now() - callStart));
          } catch (e) {
            logger.error('[GiaBrain] Retry failed:', e);
          }
          if (res) continue;
        }

        const rateLimited = isRateLimitOrQuotaError(msg) || isRetryableServerError(msg);
        carryOverText += attemptStreamed;

        // Persist a durable checkpoint the moment something recoverable goes
        // wrong — this is what makes "nothing must get lost" actually true
        // even if the app is closed mid-failover, not just in this session.
        if (req.checkpointKey) {
          saveCheckpoint({
            key: req.checkpointKey,
            sessionId: req.checkpointKey.split(':')[0],
            messageId: req.checkpointKey.split(':')[1],
            originalPrompt: req.prompt,
            accumulatedText: carryOverText,
            history: history as { role: string; content: string }[],
            failedProvider: effectiveProvider,
            failedModel: finalModel,
            reason: msg,
            attempt: iterations,
            savedAt: Date.now(),
          });
        }

        // If we'd already streamed real content this attempt before it broke,
        // don't replay the same prompt from scratch on the next provider —
        // continue from exactly where the user's screen left off.
        const buildContinuationPrompt = () => {
          if (!carryOverText.trim()) return currentPrompt;
          history.push({ role: 'assistant', content: carryOverText });
          return `Continue exactly where you left off. Do not repeat or restate anything above — pick up mid-thought if needed. Here is what you'd written so far (for your own context, do not repeat it):\n\n"""${carryOverText.slice(-2000)}"""`;
        };

        // Simple, bounded retry for transient rate-limit / 5xx errors. We
        // deliberately do NOT hop across models or providers, nor wait out long
        // backoff windows — if it's still failing after a couple of short
        // retries, surface a clear error and let the user switch models/providers.
        // The checkpoint saved above already guarantees partial work survives.
        if (rateLimited && state.smartFallback !== false) {
          let recovered = false;
          for (let attempt = 1; attempt <= 2 && !recovered; attempt++) {
            const delay = 1500 * attempt; // 1.5s, then 3s
            useGiaStore.getState().addNotification(
              carryOverText.trim()
                ? `⚡ ${effectiveProvider} rate-limited mid-response — retrying in ${Math.round(delay / 1000)}s (your progress is saved)`
                : `⚡ ${effectiveProvider} rate-limited — retrying in ${Math.round(delay / 1000)}s`
            );
            req.onThought?.(`Rate limit on ${effectiveProvider} — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt}/2)...`);
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); };
              req.signal?.addEventListener('abort', onAbort, { once: true });
              const t = setTimeout(() => { req.signal?.removeEventListener('abort', onAbort); resolve(); }, delay);
            });
            loopReq.prompt = buildContinuationPrompt();
            loopReq.history = history;
            let retryStreamed = '';
            if (userOnStream) {
              loopReq.onStream = (chunk: string) => { retryStreamed += chunk; userOnStream(chunk); };
            }
            const retryStart = performance.now();
            try {
              res = await this.callProvider(loopReq, effectiveProvider);
              ProviderMonitor.recordSuccess(effectiveProvider, finalModel, Math.round(performance.now() - retryStart));
              recovered = true;
              if (req.checkpointKey) clearCheckpoint(req.checkpointKey);
              carryOverText = '';
            } catch (retryErr) {
              const retryMsg = retryErr instanceof Error ? retryErr.message.toLowerCase() : '';
              ProviderMonitor.recordFailure(effectiveProvider, finalModel, retryMsg, Math.round(performance.now() - retryStart));
              carryOverText += retryStreamed;
              logger.error(`[GiaBrain] Retry ${attempt} also failed:`, retryErr);
              // Stop retrying if the failure is no longer a transient rate/server error.
              if (!isRateLimitOrQuotaError(retryMsg) && !isRetryableServerError(retryMsg)) break;
            }
          }
          if (!recovered) {
            throw new Error(`${friendlyError(effectiveProvider, origError)} — your progress up to this point is saved and won't be lost. Try again shortly or switch models in Settings.`);
          }
        } else {
          // Non-rate-limit error (bad request, auth, etc.) — surface it directly.
          throw origError;
        }
      }

      let text = res!.text;
      const finishReason = res!.finishReason || 'stop';
      const wasTruncated = res!.wasTruncated || finishReason === 'length' || finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS';
      const tokenUsage = res!.tokenUsage;

      if (!text || text.trim().length === 0) {
        logger.warn('[GiaBrain] Empty response from provider, retrying...');
        continue;
      }

      // ── OutputValidator: validate and repair ────────────────
      if (state.outputValidation && !req.onStream) {
        const validated = OutputValidator.validate(text);
        if (validated.issues.length > 0) {
          logger.log('[GiaBrain] Output validation:', validated.issues);
          text = validated.sanitized;
        }
      }

      // tool execution is skipped when forceJson is active —
      // tool calls would leak execution history into the next iteration,
      // confusing the model and risking agentic loops
      const toolState = { history: history as { role: string; content: string }[], currentPrompt, clarificationAttempts };
      const toolResult = req.forceJson
        ? { didExecute: false }
        : await executeToolBlocks(text, toolState, req.onThought, req.signal, sourcesAcc, req.messageId);
      currentPrompt = toolState.currentPrompt;
      clarificationAttempts = toolState.clarificationAttempts;

      if (!toolResult.didExecute) {
        if (wasTruncated && iterations < maxIterations) {
          req.onThought?.('⚠️ Response truncated — continuing...');
          history.push({ role: 'assistant', content: text });
          currentPrompt = 'Continue from where you left off. Do not repeat. Just continue naturally.';
          continue;
        }
        extractMemories(req.prompt, text).catch((e) => logger.error('[GiaBrain] Memory extraction failed:', e));

        // ── Raw output detection ─────────────────────────────
        this._detectRawOutput(text);

        // Track generation
        AnalyticsTracker.trackGenerationComplete(finalModel, tokenUsage?.output || 0, Math.round(performance.now() - genStartTime), !!toolResult.didExecute, true);

        // Cache the final response
        if (state.responseCache && !req.onStream) {
          ResponseCache.set({ prompt: req.prompt, model: finalModel, provider: effectiveProvider, systemPrompt: req.systemPrompt }, text);
        }

        // Deduct tokens from provider
        if (tokenUsage?.total) {
          useProviderStore.getState().deductTokens(effectiveProvider, tokenUsage.total);
        }

        const finalResponse = await PluginManager.runAfterGenerate({ text, provider: effectiveProvider, model: finalModel });
        return { ...finalResponse, provider: effectiveProvider, sources: sourcesAcc.length > 0 ? sourcesAcc : undefined, finishReason, wasTruncated, tokenUsage };
      }

      if (toolResult.result === '__CLARIFICATION__') {
        return { text: '__CLARIFICATION__', provider: effectiveProvider, model: finalModel };
      }

      if (toolResult.result === 'malformed_json') {
        currentPrompt = `Your previous response had invalid JSON in a tool block. Fix the syntax and try again.`;
        continue;
      }
    }
    throw new Error('Max agentic iterations reached.');
  }

  private _detectRawOutput(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Raw JSON starting directly (not in fence)
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { JSON.parse(trimmed); AnalyticsTracker.trackRawOutput('json', trimmed.slice(0, 200)); return; } catch { /* not parseable */ }
    }

    // JSON inside ```json fence but nothing else — raw dump
    if (/^```json\n?[\s\S]*?\n?```$/.test(trimmed)) {
      AnalyticsTracker.trackRawOutput('json_fence', trimmed.slice(0, 200));
      return;
    }

    // Raw markdown — mostly code fences, little explanation
    const fences = (trimmed.match(/```/g) || []).length;
    if (fences >= 4) {
      const textLen = trimmed.replace(/```[\s\S]*?```/g, '').trim().length;
      if (textLen < 50) {
        AnalyticsTracker.trackRawOutput('markdown', trimmed.slice(0, 200));
      }
    }
  }

  async fetchURL(url: string): Promise<string> {
    try {
      const { default: wf } = await import('./WebFetchService');
      const page = await wf.fetch(url, { format: 'markdown', maxChars: 60000 });
      return `# ${page.title}\n\n${page.content}`;
    } catch (e: unknown) { throw new Error(`Failed to fetch ${url}: ${e instanceof Error ? e.message : 'Unknown error'}`); }
  }

  /**
   * Collaborative multi-provider generation: sends the same prompt to all
   * connected providers in parallel, collects their responses, then uses
   * the primary provider to synthesize an agreed-upon answer.
   *
   * onProviderStatus is called with { provider, model, status } for each
   * provider so the UI can show animated orbs/indicators.
   */
  async generateCollaborative(
    req: BrainRequest,
    onProviderStatus?: (status: { provider: string; model: string; status: 'thinking' | 'responding' | 'done' | 'error' }) => void,
  ): Promise<BrainResponse> {
    const { providers } = useProviderStore.getState();
    const connected = Object.entries(providers)
      .filter(([id, cfg]) => cfg.enabled && (id === 'local-llm' || cfg.apiKey))
      .map(([id, cfg]) => ({ id, model: cfg.model }));

    if (connected.length < 2) {
      return this.generate(req);
    }

    const primary = connected[0];
    const others = connected.slice(1);

    onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'thinking' });

    const peerResults: { provider: string; model: string; text: string }[] = [];
    const peerErrors: { provider: string; model: string; error: string }[] = [];

    const peerPromises = others.map(async (p) => {
      onProviderStatus?.({ provider: p.id, model: p.model, status: 'thinking' });
      try {
        const peerReq: BrainRequest = {
          ...req,
          providerId: p.id,
          modelOverride: p.model,
          onStream: undefined,
          onThought: undefined,
        };
        const res = await this.generate(peerReq);
        onProviderStatus?.({ provider: p.id, model: p.model, status: 'done' });
        return { provider: p.id, model: p.model, text: res.text };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'unknown error';
        onProviderStatus?.({ provider: p.id, model: p.model, status: 'error' });
        peerErrors.push({ provider: p.id, model: p.model, error: errMsg });
        return null;
      }
    });

    const primaryPromise = (async () => {
      onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'responding' });
      try {
        const res = await this.generate({ ...req, providerId: primary.id, onStream: undefined, onThought: undefined });
        onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'done' });
        return { provider: primary.id, model: primary.model, text: res.text };
      } catch {
        onProviderStatus?.({ provider: primary.id, model: primary.model, status: 'error' });
        return null;
      }
    })();

    const allResults = await Promise.all([primaryPromise, ...peerPromises]);
    const validResults = allResults.filter((r): r is { provider: string; model: string; text: string } => r !== null);

    if (validResults.length === 0) {
      throw new Error('All providers failed during collaborative generation');
    }

    if (validResults.length === 1) {
      return { text: validResults[0].text, provider: validResults[0].provider, model: validResults[0].model };
    }

    peerResults.push(...validResults);

    const synthesisPrompt = `You are a synthesis agent. Multiple AI models have responded to the same user query. Your job is to combine their perspectives into one clear, comprehensive, agreed-upon answer.

USER QUERY:
${req.prompt}

--- RESPONSES ---
${peerResults.map((r, i) => `[${i + 1}] ${r.provider}/${r.model}:\n${r.text}`).join('\n\n')}
--- END RESPONSES ---

Synthesize these into ONE coherent response. Use the strongest parts from each. If they disagree, acknowledge the different perspectives but provide the most well-reasoned conclusion. Do NOT list them separately — produce a single unified answer.`;

    const synthesisRes = await this.generate({
      ...req,
      providerId: primary.id,
      prompt: synthesisPrompt,
      onStream: req.onStream,
      onThought: (t) => req.onThought?.(`[Synthesis] ${t}`),
    });

    return {
      ...synthesisRes,
      provider: primary.id,
      model: primary.model,
    };
  }
}

export default GiaBrain.getInstance();
