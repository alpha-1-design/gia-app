import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModelsDevCatalog } from '../ModelsDevCatalog';

const { providerRegistry } = await import('../ProviderRegistry');

describe('ProviderRegistry', () => {
  beforeEach(async () => {
    // Reset the singleton for isolation
    (providerRegistry as unknown as { providers: Map<string, unknown> }).providers = new Map();
    (providerRegistry as unknown as { models: Map<string, unknown> }).models = new Map();
    (providerRegistry as unknown as { imageModels: Map<string, unknown> }).imageModels = new Map();
    (providerRegistry as unknown as { loaded: boolean }).loaded = false;
    await providerRegistry.init();
  });

  describe('init with fallback providers', () => {
    it('loads fallback providers', () => {
      expect(providerRegistry.getAllIds()).toContain('opencode');
      expect(providerRegistry.getAllIds()).toContain('openrouter');
      expect(providerRegistry.getAllIds()).toContain('ollama');
      expect(providerRegistry.getAllIds()).toContain('openai');
      expect(providerRegistry.getAllIds()).toContain('nvidia');
      expect(providerRegistry.getAllProviders()).toHaveLength(22);
    });

    it('does not list gateways, placeholders, or unconfigured local servers as providers', () => {
      expect(providerRegistry.getAllIds()).not.toContain('cloudflare-gateway');
      expect(providerRegistry.getAllIds()).not.toContain('custom-openai');
      expect(providerRegistry.getAllIds()).not.toContain('vllm');
      expect(providerRegistry.getAllIds()).not.toContain('requesty');
    });

    it('loads fallback models', () => {
      const models = providerRegistry.getModels('opencode');
      expect(models.length).toBeGreaterThan(0);
    });

    it('loads fallback image models', () => {
      expect(providerRegistry.getImageModel('openai')).toBe('dall-e-3');
    });
  });

  describe('getProvider', () => {
    it('returns provider def by id', () => {
      const def = providerRegistry.getProvider('openai');
      expect(def).toBeDefined();
      expect(def!.label).toBe('OpenAI');
    });

    it('returns undefined for unknown id', () => {
      expect(providerRegistry.getProvider('unknown')).toBeUndefined();
    });
  });

  describe('getLabel', () => {
    it('returns label for known provider', () => {
      expect(providerRegistry.getLabel('ollama')).toBe('Ollama (Local)');
      expect(providerRegistry.getLabel('nvidia')).toBe('NVIDIA NIM');
    });

    it('returns id as label for unknown provider', () => {
      expect(providerRegistry.getLabel('ghost')).toBe('ghost');
    });
  });

  describe('getBaseUrl', () => {
    it('returns base URL', () => {
      expect(providerRegistry.getBaseUrl('openai')).toBe('https://api.openai.com/v1');
    });

    it('returns empty for unknown', () => {
      expect(providerRegistry.getBaseUrl('unknown')).toBe('');
    });
  });

  describe('getDefaultModel', () => {
    it('returns default model', () => {
      expect(providerRegistry.getDefaultModel('openai')).toBe('gpt-4o-mini');
    });

    it('returns empty for unknown', () => {
      expect(providerRegistry.getDefaultModel('unknown')).toBe('');
    });
  });

  describe('getListingType', () => {
    it('returns listing type', () => {
      expect(providerRegistry.getListingType('openai')).toBe('openai');
      expect(providerRegistry.getListingType('ollama')).toBe('ollama');
    });

    it('returns openai as fallback for unknown', () => {
      expect(providerRegistry.getListingType('unknown')).toBe('openai');
    });
  });

  describe('getNeedsApiKey', () => {
    it('returns true for API-key providers', () => {
      expect(providerRegistry.getNeedsApiKey('openai')).toBe(true);
    });

    it('returns false for local providers', () => {
      expect(providerRegistry.getNeedsApiKey('ollama')).toBe(false);
    });

    it('returns true for unknown', () => {
      expect(providerRegistry.getNeedsApiKey('unknown')).toBe(true);
    });
  });

  describe('resolveAlias', () => {
    it('resolves direct match', () => {
      expect(providerRegistry.resolveAlias('openai')).toBe('openai');
    });

    it('resolves alias', () => {
      expect(providerRegistry.resolveAlias('oai')).toBe('openai');
      expect(providerRegistry.resolveAlias('ol')).toBe('ollama');
      expect(providerRegistry.resolveAlias('or')).toBe('openrouter');
    });

    it('returns input unchanged for unknown', () => {
      expect(providerRegistry.resolveAlias('nope')).toBe('nope');
    });
  });

  describe('getModels', () => {
    it('returns model list for provider', () => {
      const models = providerRegistry.getModels('openai');
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('label');
      expect(models[0]).toHaveProperty('free');
    });

    it('does not expose fabricated OpenAI or xAI model IDs in fallback catalogs', () => {
      expect(providerRegistry.getModels('openai').map(model => model.id)).not.toEqual(
        expect.arrayContaining(['gpt-5.6-sol', 'gpt-5.6-terra']),
      );
      expect(providerRegistry.getModels('xai').map(model => model.id)).not.toContain('grok-4.20');
    });

    it('returns empty array for unknown', () => {
      expect(providerRegistry.getModels('unknown')).toEqual([]);
    });
  });

  describe('applyCatalog', () => {
    const catalog: ModelsDevCatalog = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        models: {
          'new-model': { id: 'new-model', name: 'New Model', tool_call: true, modalities: { input: ['text', 'image'] }, limit: { context: 128000 }, cost: { input: 0.5 }, release_date: '2026-01-01' },
        },
      },
      google: {
        id: 'google',
        name: 'Google',
        models: {
          'gemini-x': { id: 'gemini-x', name: 'Gemini X', tool_call: true, modalities: { input: ['text'] }, limit: { context: 1048576 }, cost: { input: 0 }, release_date: '2025-06-01' },
        },
      },
      'not-mapped': {
        id: 'not-mapped',
        name: 'Nope',
        models: { z: { id: 'z', name: 'Z' } },
      },
    };

    it('replaces mapped catalogs and derives context/tools/vision/free', () => {
      const changed = providerRegistry.applyCatalog(catalog);
      expect(changed).toContain('openai');
      expect(changed).toContain('gemini');
      expect(changed).not.toContain('not-mapped');

      const model = providerRegistry.getModels('openai').find((m) => m.id === 'new-model');
      expect(model).toBeDefined();
      expect(model!.context).toBe('128k');
      expect(model!.contextTokens).toBe(128000);
      expect(model!.vision).toBe(true);
      expect(model!.tools).toBe(true);
      expect(model!.free).toBe(false);
      expect(providerRegistry.getContextTokens('openai', 'new-model')).toBe(128000);

      const gem = providerRegistry.getModels('gemini').find((m) => m.id === 'gemini-x');
      expect(gem!.context).toBe('1M');
      expect(gem!.contextTokens).toBe(1048576);
      expect(gem!.free).toBe(true);
    });

    it('preserves the provider default model when models.dev no longer lists it', () => {
      providerRegistry.applyCatalog({
        openai: { id: 'openai', name: 'OpenAI', models: { 'brand-new': { id: 'brand-new', name: 'Brand New' } } },
      });
      const ids = providerRegistry.getModels('openai').map((m) => m.id);
      expect(ids).toContain('brand-new');
      expect(ids).toContain('gpt-4o-mini');
      expect(ids.indexOf('gpt-4o-mini')).toBe(0);
    });
  });

  describe('ensureLoaded', () => {
    it('does not re-init if already loaded', async () => {
      await providerRegistry.ensureLoaded();
      const spy = vi.spyOn(providerRegistry, 'init' as never);
      await providerRegistry.ensureLoaded();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
