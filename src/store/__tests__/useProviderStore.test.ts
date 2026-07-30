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
});
