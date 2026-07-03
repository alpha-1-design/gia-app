import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import type { BrainRequest, BrainResponse } from './providers/types';
import { callOpenAICompat } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGeminiNative } from './providers/gemini';
import { callLocalLLM } from './providers/local';
import { buildGiaSystem, setSystemContext } from './buildGiaSystem';
import { buildMessages, selectBestModel } from './brain/modelUtils';
import { buildOpenAITools, buildAnthropicTools, buildGeminiTools } from './brain/toolSchemas';
import { executeToolBlocks } from './brain/toolRunner';
import { extractMemories } from './brain/memoryExtractor';
import { retryFetch, friendlyError } from './brain/network';
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

  private async callProvider(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider } = useProviderStore.getState();
    const ctx: import('./providers/types').BrainContext = {
      buildSystemPrompt: (p, m, mode) => this.buildSystemPrompt(p, m, mode),
      buildMessages: buildMessages as import('./providers/types').BrainContext['buildMessages'],
      buildOpenAITools: (() => buildOpenAITools() as unknown as ReturnType<import('./providers/types').BrainContext['buildOpenAITools']>) as unknown as import('./providers/types').BrainContext['buildOpenAITools'],
      buildAnthropicTools: (() => buildAnthropicTools() as unknown as ReturnType<import('./providers/types').BrainContext['buildAnthropicTools']>) as unknown as import('./providers/types').BrainContext['buildAnthropicTools'],
      buildGeminiTools: (() => buildGeminiTools() as unknown as ReturnType<import('./providers/types').BrainContext['buildGeminiTools']>) as unknown as import('./providers/types').BrainContext['buildGeminiTools'],
      retryFetch, friendlyError,
    };
    if (activeProvider === 'anthropic') {
      return callAnthropic(req, ctx);
    }
    if (activeProvider === 'gemini') {
      return callGeminiNative(req, ctx);
    }
    if (activeProvider === 'local-llm') {
      return callLocalLLM(req, ctx);
    }
    return callOpenAICompat(req, ctx);
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (activeProvider !== 'local-llm' && (!config.enabled || !config.apiKey)) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    const state = useGiaStore.getState();
    const effectiveModel = config.model;

    // ── ResponseCache: check for cached response ──────────────
    if (state.responseCache && !req.onStream) {
      const cached = ResponseCache.get({
        prompt: req.prompt,
        model: effectiveModel,
        provider: activeProvider,
        systemPrompt: req.systemPrompt,
      });
      if (cached) {
        logger.log('[GiaBrain] Cache hit');
        return { text: cached, provider: activeProvider, model: effectiveModel };
      }
    }

    // Auto-select best model for this request's feature needs
    // Skip vision-based model switching when local vision is enabled
    const needsVision = req.localVision ? false : !!(req.images && req.images.length > 0);
    const selection = selectBestModel(activeProvider, config.model, needsVision);
    const finalModel = selection.model;
    if (selection.switched) {
      useProviderStore.getState().setProviderModel(activeProvider, finalModel);
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
      if (activeProvider === 'anthropic') {
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

    while (iterations < maxIterations) {
      if (req.signal?.aborted) throw new Error('Request aborted');
      iterations++;
      loopReq.prompt = currentPrompt;
      loopReq.history = history;

      const callStart = performance.now();
      let res: BrainResponse | undefined;

      try {
        res = await this.callProvider(loopReq);
        ProviderMonitor.recordSuccess(activeProvider, finalModel, Math.round(performance.now() - callStart));
      } catch (e: unknown) {
        const origError = e as Error;
        const msg = e instanceof Error ? e.message.toLowerCase() : '';
        ProviderMonitor.recordFailure(activeProvider, finalModel, msg, Math.round(performance.now() - callStart));

        // Retry once without native tool schemas
        if (!loopReq._skipNativeSchemas && (
          msg.includes('tools') || msg.includes('tool') ||
          msg.includes('function') || msg.includes('functions') ||
          msg.includes('400') || msg.includes('bad request')
        )) {
          loopReq._skipNativeSchemas = true;
          try {
            res = await this.callProvider(loopReq);
            if (res) ProviderMonitor.recordSuccess(activeProvider, finalModel, Math.round(performance.now() - callStart));
          } catch (e) {
            logger.error('[GiaBrain] Retry failed:', e);
          }
          if (res) continue;
        }

        // Smart fallback using ProviderMonitor
        if (state.smartFallback) {
          const { providers } = useProviderStore.getState();
          const availableProviders = Object.entries(providers)
            .filter(([p, cfg]) => p !== activeProvider && cfg.enabled && cfg.apiKey)
            .map(([p, cfg]) => ({ provider: p, model: cfg.model }));

          const best = ProviderMonitor.getBestProvider(availableProviders);
          if (best) {
            useProviderStore.getState().setActiveProvider(best.provider);
            useGiaStore.getState().addNotification(`Failing over to ${best.provider}/${best.model}`);
            loopReq._skipNativeSchemas = false;
            try {
              res = await this.callProvider(loopReq);
              ProviderMonitor.recordSuccess(best.provider, best.model, Math.round(performance.now() - callStart));
            } catch (e) {
              logger.error('[GiaBrain] Smart fallback also failed:', e);
              throw origError;
            }
          } else {
            throw origError;
          }
        } else {
          // Legacy fallback
          const { providers } = useProviderStore.getState();
          const fallbackProvider = (Object.entries(providers) as [string, { enabled: boolean; apiKey: string; model: string }][])
            .find(([p, cfg]) => p !== activeProvider && cfg.enabled && cfg.apiKey);

          if (fallbackProvider) {
            const [newProvider, newCfg] = fallbackProvider;
            useProviderStore.getState().setActiveProvider(newProvider);
            const sel = selectBestModel(newProvider, newCfg.model, false);
            if (sel.switched) useProviderStore.getState().setProviderModel(newProvider, sel.model);
            loopReq._skipNativeSchemas = false;
            try {
              res = await this.callProvider(loopReq);
            } catch (e) {
              logger.error('[GiaBrain] Fallback also failed:', e);
              throw origError;
            }
          } else {
            throw origError;
          }
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
        : await executeToolBlocks(text, toolState, req.onThought, req.signal, sourcesAcc);
      currentPrompt = toolState.currentPrompt;
      clarificationAttempts = toolState.clarificationAttempts;

      if (!toolResult.didExecute) {
        if (wasTruncated && iterations < maxIterations) {
          req.onThought?.('⚠️ Response truncated — continuing...');
          history.push({ role: 'assistant', content: text });
          currentPrompt = 'Continue from where you left off. Do not repeat. Just continue naturally.';
          continue;
        }
        extractMemories(req.prompt, text);

        // ── Raw output detection ─────────────────────────────
        this._detectRawOutput(text);

        // Track generation
        AnalyticsTracker.trackGenerationComplete(finalModel, tokenUsage?.output || 0, Math.round(performance.now() - genStartTime), !!toolResult.didExecute, true);

        // Cache the final response
        if (state.responseCache && !req.onStream) {
          ResponseCache.set({ prompt: req.prompt, model: finalModel, provider: activeProvider, systemPrompt: req.systemPrompt }, text);
        }

        const finalResponse = await PluginManager.runAfterGenerate({ text, provider: activeProvider, model: config.model });
        return { ...finalResponse, sources: sourcesAcc.length > 0 ? sourcesAcc : undefined, finishReason, wasTruncated, tokenUsage };
      }

      if (toolResult.result === '__CLARIFICATION__') {
        return { text: '__CLARIFICATION__', provider: activeProvider, model: config.model };
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
}

export default GiaBrain.getInstance();
