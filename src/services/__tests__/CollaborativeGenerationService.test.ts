import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderHealthRecord } from '../ProviderMonitor';
import type { BrainRequest, BrainResponse } from '../providers/types';
import { useProviderStore } from '../../store/useProviderStore';

vi.mock('../GiaBrain', () => ({
  default: { generate: vi.fn() },
}));

vi.mock('../ProviderMonitor', () => ({
  default: { testProvider: vi.fn() },
}));

import GiaBrain from '../GiaBrain';
import ProviderMonitor from '../ProviderMonitor';
import CollaborativeGenerationService from '../CollaborativeGenerationService';

function healthRecord(providerId: string, online: boolean): ProviderHealthRecord {
  return {
    providerId,
    modelId: 'test-model',
    status: online ? 'healthy' : 'down',
    successRate: online ? 1 : 0,
    avgLatencyMs: 1,
    lastError: online ? null : 'unreachable',
    latencyMs: 1,
    errorRate: online ? 0 : 1,
    totalCalls: 1,
    failedCalls: online ? 0 : 1,
    lastSuccess: online ? Date.now() : null,
    lastChecked: Date.now(),
    online,
  };
}

const configuredProvider = (model: string) => ({
  apiKey: 'test-key',
  model,
  enabled: true,
});

describe('CollaborativeGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProviderStore.setState({
      providers: {
        openai: configuredProvider('gpt-4o-mini'),
        anthropic: configuredProvider('claude-sonnet-4-6'),
        gemini: configuredProvider('gemini-2.5-flash'),
        opencode: configuredProvider('deepseek-v4.1-flash'),
        groq: configuredProvider('llama-3.3-70b-versatile'),
        'local-llm': configuredProvider('local-model'),
        ollama: configuredProvider('llama3.2'),
        lmstudio: configuredProvider('local-model'),
      },
      activeProvider: 'openai',
    });
    vi.mocked(ProviderMonitor.testProvider).mockImplementation(async (id) => healthRecord(id, id === 'openai'));
    vi.mocked(GiaBrain.generate).mockImplementation(async (req) => ({
      text: 'answer',
      provider: req.providerId ?? 'openai',
      model: req.modelOverride ?? 'test-model',
    }));
  });

  it('tests cloud endpoints first, excludes local providers, and only uses reachable providers', async () => {
    const events: string[] = [];
    vi.mocked(ProviderMonitor.testProvider).mockImplementation(async (id) => {
      events.push(`check:${id}`);
      return healthRecord(id, id === 'openai');
    });
    vi.mocked(GiaBrain.generate).mockImplementation(async (req) => {
      events.push(`generate:${req.providerId}`);
      return { text: 'answer', provider: req.providerId ?? 'openai', model: 'test-model' };
    });

    const result = await CollaborativeGenerationService.generate({ prompt: 'Research this' });

    expect(events).toEqual([
      'check:openai',
      'check:anthropic',
      'check:gemini',
      'generate:openai',
    ]);
    expect(result.provider).toBe('openai');
    expect(ProviderMonitor.testProvider).toHaveBeenCalledTimes(3);
    expect(GiaBrain.generate).toHaveBeenCalledTimes(1);
    expect(events).not.toContain('check:opencode');
    expect(events).not.toContain('check:groq');
    expect(events).not.toContain('check:local-llm');
  });

  it('falls back to normal generation when no cloud providers are configured', async () => {
    useProviderStore.setState({ providers: { 'local-llm': configuredProvider('local-model') } });
    const request: BrainRequest = { prompt: 'Hello' };
    const response: BrainResponse = { text: 'normal', provider: 'local-llm', model: 'local-model' };
    vi.mocked(GiaBrain.generate).mockResolvedValue(response);

    await expect(CollaborativeGenerationService.generate(request)).resolves.toEqual(response);
    expect(ProviderMonitor.testProvider).not.toHaveBeenCalled();
    expect(GiaBrain.generate).toHaveBeenCalledWith(request);
  });

  it('does not send the prompt when every configured cloud endpoint is unreachable', async () => {
    vi.mocked(ProviderMonitor.testProvider).mockImplementation(async (id) => healthRecord(id, false));

    await expect(CollaborativeGenerationService.generate({ prompt: 'Research this' }))
      .rejects.toThrow('could not reach any configured cloud provider');
    expect(GiaBrain.generate).not.toHaveBeenCalled();
  });
});
