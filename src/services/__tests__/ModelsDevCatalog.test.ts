import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { store, mockGet, mockSet } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    mockGet: vi.fn(async (key: string) => store.get(key) ?? null),
    mockSet: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  };
});

vi.mock('../../store/idb-storage', () => ({
  idbStorage: {
    getItem: mockGet,
    setItem: mockSet,
    removeItem: vi.fn(async () => {}),
  },
}));

const {
  MODELS_DEV_PROVIDER_MAP,
  trimModelsDevCatalog,
  loadModelsDevCatalog,
} = await import('../ModelsDevCatalog');

const RAW = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: {
      'gpt-x': { id: 'gpt-x', name: 'GPT X', tool_call: true, modalities: { input: ['text', 'image'] }, limit: { context: 128000, output: 4096 }, cost: { input: 0.5 }, release_date: '2026-01-01', secret_extra: true },
      'no-id': { name: 'Broken' },
    },
  },
  google: {
    id: 'google',
    name: 'Google',
    models: { 'gemini-x': { id: 'gemini-x', name: 'Gemini X', tool_call: true, limit: { context: 1048576 }, cost: { input: 0 }, release_date: '2025-06-01' } },
  },
  replicate: {
    id: 'replicate',
    name: 'Replicate',
    models: { 'rep-1': { id: 'rep-1', name: 'Rep One' } },
  },
  'not-mapped': {
    id: 'not-mapped',
    name: 'Nope',
    models: { z: { id: 'z', name: 'Z' } },
  },
};

describe('ModelsDevCatalog', () => {
  beforeEach(() => {
    store.clear();
    mockGet.mockClear();
    mockSet.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps gemini/fireworks/ollama-style ids but only for providers it knows', () => {
    expect(MODELS_DEV_PROVIDER_MAP.gemini).toBe('google');
    expect(MODELS_DEV_PROVIDER_MAP.fireworks).toBe('fireworks-ai');
    expect(MODELS_DEV_PROVIDER_MAP).not.toHaveProperty('replicate');
    expect(MODELS_DEV_PROVIDER_MAP).not.toHaveProperty('ollama');
  });

  it('trims to mapped providers and only keeps models with ids', () => {
    const catalog = trimModelsDevCatalog(RAW);
    expect(Object.keys(catalog)).toEqual(['openai', 'google']);
    expect(Object.keys(catalog.openai.models)).toEqual(['gpt-x']);
    expect(catalog.openai.models['gpt-x'].cost?.input).toBe(0.5);
    expect(catalog.google.models['gemini-x'].limit?.context).toBe(1048576);
  });

  it('serves a fresh cache without hitting the network', async () => {
    const cached = trimModelsDevCatalog(RAW);
    store.set('gia.modelsdev.catalog.v1', JSON.stringify({ fetchedAt: Date.now(), catalog: cached }));
    const result = await loadModelsDevCatalog();
    expect(result).toEqual(cached);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fetches live and writes the trimmed catalog to cache', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => RAW,
    });
    const result = await loadModelsDevCatalog();
    expect(result && Object.keys(result)).toEqual(['openai', 'google']);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://models.opencode.ai/api.json', expect.anything());
    expect(mockSet).toHaveBeenCalled();
    const written = JSON.parse(store.get('gia.modelsdev.catalog.v1') || '{}');
    expect(written.catalog.openai.models['gpt-x'].id).toBe('gpt-x');
  });

  it('falls back to a stale cache when the live fetch fails', async () => {
    const cached = trimModelsDevCatalog(RAW);
    store.set('gia.modelsdev.catalog.v1', JSON.stringify({ fetchedAt: 1, catalog: cached }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    const result = await loadModelsDevCatalog();
    expect(result).toEqual(cached);
  });

  it('returns null when offline with no cache', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    expect(await loadModelsDevCatalog()).toBeNull();
  });

  it('force skips a fresh cache', async () => {
    const cached = trimModelsDevCatalog(RAW);
    store.set('gia.modelsdev.catalog.v1', JSON.stringify({ fetchedAt: Date.now(), catalog: cached }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => RAW });
    await loadModelsDevCatalog(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});