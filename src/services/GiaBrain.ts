import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import type { BrainRequest, BrainResponse } from './providers/types';
import { callOpenAICompat } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGeminiNative } from './providers/gemini';
import { buildGiaSystem, setSystemContext } from './buildGiaSystem';
import { buildMessages, selectBestModel } from './brain/modelUtils';
import { buildOpenAITools, buildAnthropicTools, buildGeminiTools } from './brain/toolSchemas';
import { executeToolBlocks } from './brain/toolRunner';
import { extractMemories } from './brain/memoryExtractor';
import { retryFetch, friendlyError } from './brain/network';
import PluginManager from './PluginManager';
export { setSystemContext };

export type { BrainRequest, BrainResponse } from './providers/types';

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  private buildSystemPrompt(prompt: string, moduleSpecific?: string, mode: 'append' | 'replace' = 'append'): string {
    if (mode === 'replace' && moduleSpecific) return moduleSpecific;
    const base = buildGiaSystem(prompt);
    if (!moduleSpecific) return base;
    return `${base}\n\n## Module-Specific Instructions\n${moduleSpecific}`;
  }

  private async callProvider(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider } = useProviderStore.getState();
    if (activeProvider === 'anthropic') {
      return callAnthropic(req, {
        buildSystemPrompt: (p, m, mode) => this.buildSystemPrompt(p, m, mode),
        buildMessages, buildOpenAITools, buildAnthropicTools, buildGeminiTools,
        retryFetch, friendlyError,
      });
    }
    if (activeProvider === 'gemini') {
      return callGeminiNative(req, {
        buildSystemPrompt: (p, m, mode) => this.buildSystemPrompt(p, m, mode),
        buildMessages, buildOpenAITools, buildAnthropicTools, buildGeminiTools,
        retryFetch, friendlyError,
      });
    }
    return callOpenAICompat(req, {
      buildSystemPrompt: (p, m, mode) => this.buildSystemPrompt(p, m, mode),
      buildMessages, buildOpenAITools, buildAnthropicTools, buildGeminiTools,
      retryFetch, friendlyError,
    });
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const config = providers[activeProvider];
    if (!config.enabled || !config.apiKey) {
      throw new Error('No provider connected. Go to Settings → Engine Room and type: connect');
    }

    // Auto-select best model for this request's feature needs
    const needsVision = !!(req.images && req.images.length > 0);
    const selection = selectBestModel(activeProvider, config.model, needsVision);
    const effectiveModel = selection.model;
    if (selection.switched) {
      useProviderStore.getState().setProviderModel(activeProvider, effectiveModel);
      useGiaStore.getState().addNotification(selection.reason || `Switched to ${effectiveModel}`);
    }

    // Run plugin beforeGenerate hooks
    let currentPrompt = await PluginManager.runBeforeGenerate(req.prompt);
    const history = req.history ? [...req.history] : [];
    let iterations = 0;
    const maxIterations = 10;
    let clarificationAttempts = 0;

    // Calibrate temperature based on prompt type
    const calibratedTemp = (() => {
      if (req.temperature !== undefined) return req.temperature;
      const lower = req.prompt.toLowerCase();
      if (lower.startsWith('write') || lower.startsWith('draft') || lower.startsWith('compose') || lower.startsWith('create')) return 0.9;
      if (lower.startsWith('summarize') || lower.startsWith('explain') || lower.startsWith('what is') || lower.startsWith('how')) return 0.3;
      if (lower.startsWith('fix') || lower.startsWith('debug') || lower.startsWith('refactor') || lower.startsWith('review')) return 0.2;
      if (lower.startsWith('translate')) return 0.5;
      return 0.7;
    })();
    const loopReq: BrainRequest = { ...req, temperature: calibratedTemp };

    while (iterations < maxIterations) {
      if (req.signal?.aborted) throw new Error('Request aborted');
      iterations++;
      loopReq.prompt = currentPrompt;
      loopReq.history = history;

      let res: BrainResponse | undefined;
      try {
        res = await this.callProvider(loopReq);
      } catch (e: unknown) {
        const origError = e as Error;
        const msg = e instanceof Error ? e.message.toLowerCase() : '';

        // Retry once without native tool schemas
        if (!loopReq._skipNativeSchemas && !req.onStream && (
          msg.includes('tools') || msg.includes('tool') ||
          msg.includes('function') || msg.includes('functions') ||
          msg.includes('400') || msg.includes('bad request')
        )) {
          loopReq._skipNativeSchemas = true;
          try {
            res = await this.callProvider(loopReq);
          } catch (e) {
            logger.error('[GiaBrain] Retry failed:', e);
          }
          if (res) continue;
        }

        // Provider-level fallback
        const { providers } = useProviderStore.getState();
        const { activeProvider } = useProviderStore.getState();
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

      const text = res!.text;
      const finishReason = res!.finishReason || 'stop';
      const wasTruncated = res!.wasTruncated || finishReason === 'length' || finishReason === 'max_tokens' || finishReason === 'MAX_TOKENS';

      if (!text || text.trim().length === 0) {
        logger.warn('[GiaBrain] Empty response from provider, retrying...');
        continue;
      }

      const state = { history, currentPrompt, clarificationAttempts };
      const toolResult = await executeToolBlocks(text, state, req.onThought, req.signal);
      currentPrompt = state.currentPrompt;
      clarificationAttempts = state.clarificationAttempts;

      if (!toolResult.didExecute) {
        // No tool blocks — final response
        // Check if response was truncated and auto-continue
        if (wasTruncated && iterations < maxIterations) {
          req.onThought?.('⚠️ Response truncated — continuing...');
          // Add the partial response to history and continue
          history.push({ role: 'assistant', content: text });
          currentPrompt = 'Continue from where you left off. Do not repeat. Just continue naturally.';
          continue;
        }
        extractMemories(req.prompt, text);
        const finalResponse = await PluginManager.runAfterGenerate({ text, provider: activeProvider, model: config.model });
        return { ...finalResponse, finishReason, wasTruncated };
      }

      if (toolResult.result === '__CLARIFICATION__') {
        return { text: '__CLARIFICATION__', provider: activeProvider, model: config.model };
      }

      // If tool execution failed due to malformed JSON, inject repair hint and loop
      if (toolResult.result === 'malformed_json') {
        currentPrompt = `Your previous response had invalid JSON in a tool block. Fix the syntax and try again.`;
        continue;
      }
    }
    throw new Error('Max agentic iterations reached.');
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
