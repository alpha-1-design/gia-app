import { describe, it, expect, vi, beforeEach } from 'vitest';
import { healProviderKeys, whenHydrated } from '../credentialRecovery';
import { useProviderStore } from '../../store/useProviderStore';
import { useCredentialStore } from '../../store/useCredentialStore';

const getNativeMock = vi.hoisted(() => vi.fn(async (): Promise<string | undefined> => undefined));

vi.mock('../CredentialVault', () => ({
  default: {
    getNative: (...args: unknown[]) => getNativeMock(...(args as [])),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    hydrate: vi.fn(async () => undefined),
    get: vi.fn(() => undefined),
  },
}));

// Deterministic registry: every id except 'local' needs an API key.
vi.mock('../ProviderRegistry', () => ({
  providerRegistry: {
    ensureLoaded: vi.fn(async () => {}),
    getNeedsApiKey: vi.fn((id: string) => id !== 'local'),
    getAllIds: vi.fn(() => ['openai', 'anthropic', 'local']),
    getDefaultModel: vi.fn(() => 'model-x'),
    getProvider: vi.fn(() => undefined),
    getModels: vi.fn(() => []),
  },
}));

type ProviderCfg = { apiKey: string; enabled: boolean; model: string };
type CredCfg = { serviceId: string; label: string; kind: 'api_key'; value: string; updatedAt: number };

function resetProviders(providers: Record<string, ProviderCfg>) {
  useProviderStore.setState({ providers: providers as never, activeProvider: 'opencode' });
}

function resetCredentials(credentials: Record<string, CredCfg>) {
  useCredentialStore.setState({ credentials });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Real persistence hydration is asynchronous and irrelevant here — treat
  // both stores as hydrated so heal() proceeds straight to recovery.
  useProviderStore.persist.hasHydrated = () => true;
  useCredentialStore.persist.hasHydrated = () => true;
  resetCredentials({});
});

describe('healProviderKeys', () => {
  it('restores an empty provider key from the credential store', async () => {
    resetProviders({
      openai: { apiKey: '', enabled: false, model: 'gpt-4o' },
      local: { apiKey: '', enabled: true, model: 'lm' },
    });
    resetCredentials({
      openai: { serviceId: 'openai', label: 'OpenAI', kind: 'api_key', value: 'sk-from-creds', updatedAt: 1 },
    });

    const recovered = await healProviderKeys();

    expect(recovered).toEqual(['openai']);
    expect(useProviderStore.getState().providers.openai.apiKey).toBe('sk-from-creds');
    expect(useProviderStore.getState().providers.openai.enabled).toBe(true);
    // needsApiKey=false providers are never restored from any source.
    expect(useProviderStore.getState().providers.local.apiKey).toBe('');
    expect(getNativeMock).not.toHaveBeenCalledWith('local');
  });

  it('falls back to the native vault when the credential store copy is gone too', async () => {
    resetProviders({ anthropic: { apiKey: '', enabled: false, model: 'claude' } });
    resetCredentials({});
    getNativeMock.mockResolvedValueOnce('sk-native-only');

    const recovered = await healProviderKeys();

    expect(recovered).toEqual(['anthropic']);
    expect(useProviderStore.getState().providers.anthropic.apiKey).toBe('sk-native-only');
    expect(getNativeMock).toHaveBeenCalledWith('anthropic');
  });

  it('never overwrites a live key and does not consult the vault for it', async () => {
    resetProviders({ openai: { apiKey: 'sk-live', enabled: true, model: 'gpt-4o' } });
    resetCredentials({
      openai: { serviceId: 'openai', label: 'OpenAI', kind: 'api_key', value: 'sk-old', updatedAt: 1 },
    });

    const recovered = await healProviderKeys();

    expect(recovered).toEqual([]);
    expect(useProviderStore.getState().providers.openai.apiKey).toBe('sk-live');
    expect(getNativeMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when no sources have the key', async () => {
    resetProviders({ openai: { apiKey: '', enabled: false, model: 'gpt-4o' } });
    resetCredentials({});

    const recovered = await healProviderKeys();

    expect(recovered).toEqual([]);
    expect(useProviderStore.getState().providers.openai.apiKey).toBe('');
  });
});

describe('whenHydrated', () => {
  it('resolves immediately when the store has already hydrated', async () => {
    const store = { persist: { hasHydrated: () => true, onFinishHydration: vi.fn() } };
    await expect(whenHydrated(store)).resolves.toBeUndefined();
    expect(store.persist.onFinishHydration).not.toHaveBeenCalled();
  });

  it('resolves when the hydration listener fires', async () => {
    let listener: (() => void) | null = null;
    const store = {
      persist: {
        hasHydrated: () => false,
        onFinishHydration: (fn: () => void) => { listener = fn; return () => { listener = null; }; },
      },
    };
    const p = whenHydrated(store);
    expect(listener).not.toBeNull();
    (listener as unknown as () => void)();
    await expect(p).resolves.toBeUndefined();
    // The listener unsubscribed itself after firing.
    expect(listener).toBeNull();
  });
});
