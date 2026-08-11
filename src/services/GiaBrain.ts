import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';
import { useGiaStore } from '../store/useGiaStore';
import { BrainRequest, BrainResponse } from './providers/types';
import { setSystemContext } from './buildGiaSystem';
import { selectBestModel } from './brain/modelUtils';
import { extractMemories } from './brain/memoryExtractor';
import PluginManager from './PluginManager';
import ResponseCache from './ResponseCache';
import AnalyticsTracker from './AnalyticsTracker';
import ProviderService from './ProviderService';
import ToolExecutionService from './ToolExecutionService';
import ErrorHandlingService from './ErrorHandlingService';
import CollaborativeGenerationService from './CollaborativeGenerationService';

export { setSystemContext };
export type { BrainRequest, BrainResponse } from './providers/types';

class GiaBrain {
  private static instance: GiaBrain;
  static getInstance() { if (!this.instance) this.instance = new GiaBrain(); return this.instance; }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const { activeProvider, providers } = useProviderStore.getState();
    const state = useGiaStore.getState();
    const effectiveProvider = req.providerId || activeProvider;
    const config = providers[effectiveProvider];

    if (state.responseCache && !req.onStream) {
      const cached = ResponseCache.get({ prompt: req.prompt, model: config.model, provider: effectiveProvider, systemPrompt: req.systemPrompt });
      if (cached) {
        logger.log('[GiaBrain] Cache hit');
        return { text: cached, provider: effectiveProvider, model: config.model };
      }
    }

    const needsVision = !!(req.images && req.images.length > 0);
    const selection = selectBestModel(effectiveProvider, req.modelOverride || config.model, needsVision);
    const finalModel = selection.model;

    if (selection.switched && !req.modelOverride) {
      useProviderStore.getState().setProviderModel(effectiveProvider, finalModel);
      useGiaStore.getState().addNotification(selection.reason || `Switched to ${finalModel}`);
    }

    let currentPrompt = await PluginManager.runBeforeGenerate(req.prompt);
    const history = req.history ? [...req.history] : [];
    let iterations = 0;
    const maxIterations = 10;
    let clarificationAttempts = 0;
    const sourcesAcc: string[] = [];
    const genStartTime = performance.now();
    let carryOverText = '';

    while (iterations < maxIterations) {
      iterations++;
      const loopReq: BrainRequest = { ...req, prompt: currentPrompt, history };
      let res: BrainResponse | undefined;
      const callStart = performance.now();

      try {
        res = await ProviderService.callProvider(loopReq, effectiveProvider);
      } catch (e: unknown) {
        const errorResult = await ErrorHandlingService.handleErrors(e, loopReq, effectiveProvider, finalModel, callStart, carryOverText, iterations, history);
        res = errorResult.res;
        carryOverText = errorResult.carryOverText;
        if (!res) continue;
      }

      const text = res!.text;
      if (req.onThought) {
        const toolCallRegex = /(<tool_code>|<tool-code>|<function_call>|<function-call>)/;
        const match = text.match(toolCallRegex);
        const thought = match ? text.substring(0, match.index).trim() : text.trim();
        if (thought) {
          req.onThought(thought);
        }
      }

      const toolState = { history, currentPrompt, clarificationAttempts };
      const toolResult = await ToolExecutionService.execute(text, toolState, req.onThought, req.signal, sourcesAcc, req.messageId);

      currentPrompt = toolState.currentPrompt;
      clarificationAttempts = toolState.clarificationAttempts;

      if (!toolResult.didExecute) {
        extractMemories(req.prompt, text).catch((e) => logger.error('[GiaBrain] Memory extraction failed:', e));
        AnalyticsTracker.trackGenerationComplete(finalModel, res.tokenUsage?.output || 0, Math.round(performance.now() - genStartTime), !!toolResult.didExecute, true);
        if (state.responseCache && !req.onStream) {
          ResponseCache.set({ prompt: req.prompt, model: finalModel, provider: effectiveProvider, systemPrompt: req.systemPrompt }, text);
        }
        if (res.tokenUsage?.total) {
          useProviderStore.getState().deductTokens(effectiveProvider, res.tokenUsage.total);
        }
        const finalResponse = await PluginManager.runAfterGenerate({ text, provider: effectiveProvider, model: finalModel });
        return { ...finalResponse, provider: effectiveProvider, sources: sourcesAcc.length > 0 ? sourcesAcc : undefined, finishReason: res.finishReason, wasTruncated: res.wasTruncated, tokenUsage: res.tokenUsage };
      }

      if (toolResult.result === '__CLARIFICATION__') {
        return { text: '__CLARIFICATION__', provider: effectiveProvider, model: finalModel };
      }

      if (toolResult.result === 'malformed_json') {
        currentPrompt = `Your previous response had invalid JSON in a tool block. Fix the syntax and try again.`;
        continue;
      }

      if (toolResult.result === 'truncated_tool_call') {
        // currentPrompt was already set specifically by toolRunner above via
        // toolState.currentPrompt -> currentPrompt at line 83; don't clobber it.
        continue;
      }
    }
    throw new Error('Max agentic iterations reached.');
  }

  async generateCollaborative(req: BrainRequest, onProviderStatus?: (status: { provider: string; model: string; status: 'thinking' | 'responding' | 'done' | 'error' }) => void): Promise<BrainResponse> {
    return CollaborativeGenerationService.generate(req, onProviderStatus);
  }
}

export default GiaBrain.getInstance();
