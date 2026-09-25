import { useProviderStore } from '../store/useProviderStore';
import { callOpenAICompat } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGeminiNative } from './providers/gemini';
import { callLocalLLM } from './providers/local';
import { BrainRequest, BrainResponse, BrainContext } from './providers/types';
import { buildGiaSystem } from './buildGiaSystem';
import { buildMessages } from './brain/modelUtils';
import { buildOpenAITools, buildAnthropicTools, buildGeminiTools } from './brain/toolSchemas';
import { retryFetch, friendlyError } from './brain/network';
import { isOnDeviceMode } from './OfflineMode';


class ProviderService {
  public async callProvider(req: BrainRequest, overrideProvider?: string): Promise<BrainResponse> {
    // On-Device Mode: every response comes from the on-device LLM — no
    // network provider is contacted, no matter what the user had selected.
    const providerId = isOnDeviceMode() && !overrideProvider?.startsWith('local')
      ? 'local-llm'
      : (overrideProvider ?? useProviderStore.getState().activeProvider);
    const ctx: BrainContext = {
      buildSystemPrompt: this.buildSystemPrompt,
      buildMessages: buildMessages as BrainContext['buildMessages'],
      buildOpenAITools: (() => buildOpenAITools() as unknown as ReturnType<BrainContext['buildOpenAITools']>) as unknown as BrainContext['buildOpenAITools'],
      buildAnthropicTools: (() => buildAnthropicTools() as unknown as ReturnType<BrainContext['buildAnthropicTools']>) as unknown as BrainContext['buildAnthropicTools'],
      buildGeminiTools: (() => buildGeminiTools() as unknown as ReturnType<BrainContext['buildGeminiTools']>) as unknown as BrainContext['buildGeminiTools'],
      retryFetch,
      friendlyError,
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

  private buildSystemPrompt(prompt: string, moduleSpecific?: string, mode: 'append' | 'replace' = 'append'): string {
    if (mode === 'replace' && moduleSpecific) return moduleSpecific;
    const base = buildGiaSystem(prompt);
    if (!moduleSpecific) return base;
    return `${base}\n\n## Module-Specific Instructions\n${moduleSpecific}`;
  }
}

export default new ProviderService();
