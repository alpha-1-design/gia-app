import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../idb-storage', () => {
  const store = new Map<string, string>();
  return {
    idbStorage: {
      getItem: vi.fn(async (name: string) => store.get(name) ?? null),
      setItem: vi.fn(async (name: string, value: string) => { store.set(name, value); }),
      removeItem: vi.fn(async (name: string) => { store.delete(name); }),
    },
  };
});

// Mock providerRegistry with a minimal set of providers
const mockProviders: Record<string, { id: string; name: string; needsApiKey: boolean; baseUrl: string; models: { id: string; label: string; free: boolean }[] }> = {
  openai: { id: 'openai', name: 'OpenAI', needsApiKey: true, baseUrl: 'https://api.openai.com/v1', models: [{ id: 'gpt-4o', label: 'GPT-4o', free: false }, { id: 'gpt-4o-mini', label: 'GPT-4o Mini', free: false }] },
  anthropic: { id: 'anthropic', name: 'Anthropic', needsApiKey: true, baseUrl: 'https://api.anthropic.com/v1', models: [{ id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', free: false }] },
  'local-llm': { id: 'local-llm', name: 'Local LLM', needsApiKey: false, baseUrl: 'http://localhost:1234/v1', models: [{ id: 'local-model', label: 'Local Model', free: true }] },
};

vi.mock('../../services/ProviderRegistry', () => ({
  providerRegistry: {
    ensureLoaded: vi.fn(async () => {}),
    getAllIds: vi.fn(() => Object.keys(mockProviders)),
    getProvider: vi.fn((id: string) => {
      const p = mockProviders[id];
      return p ? { id: p.id, name: p.name, needsApiKey: p.needsApiKey, baseUrl: p.baseUrl, listingType: 'openai', headers: {} } : undefined;
    }),
    getModels: vi.fn((id: string) => (mockProviders[id]?.models || []).map(m => ({ ...m, tools: true, vision: false }))),
    getDefaultModel: vi.fn((id: string) => mockProviders[id]?.models[0]?.id || ''),
    getNeedsApiKey: vi.fn((id: string) => mockProviders[id]?.needsApiKey ?? true),
  },
}));

vi.mock('../../services/CorsProxy', () => ({
  corsProxy: {
    fetch: vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { useProviderStore } = await import('../useProviderStore');

describe('useProviderStore', () => {
  beforeEach(async () => {
    useProviderStore.setState({
      providers: {},
      availableModels: {},
      activeProvider: 'opencode',
      initialised: false,
      pendingTasks: [],
    });
  });

  describe('loadProviders', () => {
    it('initialises providers from registry', async () => {
      await useProviderStore.getState().loadProviders();
      const state = useProviderStore.getState();
      expect(state.initialised).toBe(true);
      expect(Object.keys(state.providers)).toEqual(['openai', 'anthropic', 'local-llm']);
      expect(state.providers.openai).toBeDefined();
      expect(state.providers.openai.apiKey).toBe('');
      expect(state.providers.openai.model).toBe('gpt-4o');
      expect(state.providers.openai.enabled).toBe(false);
    });

    it('preserves existing provider config on reload', async () => {
      useProviderStore.setState({ providers: { openai: { apiKey: 'sk-old', model: 'gpt-4o', enabled: true } } });
      await useProviderStore.getState().loadProviders();
      expect(useProviderStore.getState().providers.openai.apiKey).toBe('sk-old');
    });

    it('removes stale providers that no longer exist in registry', async () => {
      useProviderStore.setState({ providers: { ghost: { apiKey: '', model: '', enabled: false } } });
      await useProviderStore.getState().loadProviders();
      expect(useProviderStore.getState().providers.ghost).toBeUndefined();
    });
  });

  describe('setProviderKey', () => {
    it('sets key and enables provider', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      expect(useProviderStore.getState().providers.openai.apiKey).toBe('sk-test');
      expect(useProviderStore.getState().providers.openai.enabled).toBe(true);
    });

    it('does not enable provider with empty key when needsApiKey', () => {
      useProviderStore.getState().setProviderKey('openai', '');
      expect(useProviderStore.getState().providers.openai.enabled).toBe(false);
    });

    it('switches active provider when enabling a new one', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-old');
      expect(useProviderStore.getState().activeProvider).toBe('openai');
    });
  });

  describe('getActiveProviders', () => {
    it('returns empty when no providers configured', () => {
      expect(useProviderStore.getState().getActiveProviders()).toEqual([]);
    });

    it('returns providers that have keys and are enabled', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-abc');
      useProviderStore.getState().setProviderKey('local-llm', '');
      const active = useProviderStore.getState().getActiveProviders();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('openai');
    });
  });

  describe('getBestProviderForTask', () => {
    it('returns null when no active providers', () => {
      expect(useProviderStore.getState().getBestProviderForTask()).toBeNull();
    });

    it('returns the provider with highest token balance', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-1');
      useProviderStore.getState().setProviderKey('anthropic', 'sk-2');
      useProviderStore.getState().setProviderTokenBalance('openai', 500);
      useProviderStore.getState().setProviderTokenBalance('anthropic', 1000);
      const best = useProviderStore.getState().getBestProviderForTask();
      expect(best?.id).toBe('anthropic');
    });
  });

  describe('disconnectProvider', () => {
    it('clears key and disables', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      useProviderStore.getState().disconnectProvider('openai');
      expect(useProviderStore.getState().providers.openai.apiKey).toBe('');
      expect(useProviderStore.getState().providers.openai.enabled).toBe(false);
    });

    it('switches active provider away from disconnected one', () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-1');
      useProviderStore.getState().setProviderKey('anthropic', 'sk-2');
      useProviderStore.getState().setActiveProvider('openai');
      useProviderStore.getState().disconnectProvider('openai');
      expect(useProviderStore.getState().activeProvider).toBe('anthropic');
    });
  });

  describe('token management', () => {
    it('setProviderTokenBalance stores balance', () => {
      useProviderStore.getState().setProviderTokenBalance('openai', 999);
      expect(useProviderStore.getState().providers.openai.tokenBalance).toBe(999);
    });

    it('deductTokens subtracts from balance', () => {
      useProviderStore.getState().setProviderTokenBalance('openai', 1000);
      useProviderStore.getState().deductTokens('openai', 350);
      expect(useProviderStore.getState().providers.openai.tokenBalance).toBe(650);
    });

    it('deductTokens does not go below zero', () => {
      useProviderStore.getState().setProviderTokenBalance('openai', 100);
      useProviderStore.getState().deductTokens('openai', 999);
      expect(useProviderStore.getState().providers.openai.tokenBalance).toBe(0);
    });

    it('deductTokens does nothing for Infinity balance', () => {
      useProviderStore.getState().setProviderTokenBalance('openai', Infinity);
      useProviderStore.getState().deductTokens('openai', 999);
      expect(useProviderStore.getState().providers.openai.tokenBalance).toBe(Infinity);
    });
  });

  describe('pendingTasks', () => {
    it('addPendingTask creates a task with id and pending status', () => {
      const id = useProviderStore.getState().addPendingTask({ prompt: 'hello', sessionId: 's1' });
      expect(id).toBeTruthy();
      const task = useProviderStore.getState().pendingTasks[0];
      expect(task.status).toBe('pending');
      expect(task.prompt).toBe('hello');
    });

    it('removePendingTask removes by id', () => {
      const id = useProviderStore.getState().addPendingTask({ prompt: 'test', sessionId: 's1' });
      expect(useProviderStore.getState().pendingTasks).toHaveLength(1);
      useProviderStore.getState().removePendingTask(id);
      expect(useProviderStore.getState().pendingTasks).toHaveLength(0);
    });
  });

  // =========================================================================
  // fetchModels — failure modes & fallback
  // =========================================================================
  describe('fetchModels', () => {
    let corsProxyFetch: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const mod = await import('../../services/CorsProxy');
      corsProxyFetch = vi.mocked((mod as unknown as { corsProxy: { fetch: ReturnType<typeof vi.fn> } }).corsProxy.fetch);
      corsProxyFetch.mockReset();
      // Default: return empty data
      corsProxyFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    });

    it('returns empty array for unknown provider', async () => {
      const models = await useProviderStore.getState().fetchModels('nonexistent');
      expect(models).toEqual([]);
    });

    it('falls back to catalog when API returns 401', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-bad');
      corsProxyFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
      const models = await useProviderStore.getState().fetchModels('openai');
      // Should fall back to catalog (the 2 mocked models)
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      // Status should be 'catalog', not 'live'
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('falls back to catalog when API returns 403', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-forbidden');
      corsProxyFetch.mockResolvedValue(new Response('Forbidden', { status: 403 }));
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('falls back to catalog when API returns 500', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      corsProxyFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('falls back to catalog when fetch throws network error', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      corsProxyFetch.mockRejectedValue(new Error('Network request failed'));
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('falls back to catalog when API returns empty data array', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      corsProxyFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
      const models = await useProviderStore.getState().fetchModels('openai');
      // Empty live response should NOT show 'Live' badge — must use catalog
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('falls back to catalog when API returns malformed JSON', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      corsProxyFetch.mockResolvedValue(new Response('not json at all', { status: 200 }));
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('returns catalog directly when no API key and provider needs one', async () => {
      // openai needs API key, and we haven't set one
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.some(m => m.id === 'gpt-4o')).toBe(true);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('catalog');
    });

    it('marks as live when API returns valid models', async () => {
      useProviderStore.getState().setProviderKey('openai', 'sk-test');
      corsProxyFetch.mockResolvedValue(new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-4o', name: 'GPT-4o', context_length: 128000 },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', context_length: 128000, pricing: { prompt: '0' } },
          ],
        }),
        { status: 200 },
      ));
      const models = await useProviderStore.getState().fetchModels('openai');
      expect(models.length).toBe(2);
      expect(useProviderStore.getState().modelListStatus?.openai).toBe('live');
      // The free model should be detected from pricing
      const mini = models.find(m => m.id === 'gpt-4o-mini');
      expect(mini?.free).toBe(true);
    });

    it('handles providers without listingType gracefully', async () => {
      useProviderStore.getState().setProviderKey('local-llm', '');
      const models = await useProviderStore.getState().fetchModels('local-llm');
      // local-llm has listingType 'openai' in the mock
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
    });
  });
});
