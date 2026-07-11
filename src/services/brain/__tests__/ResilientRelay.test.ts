import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { pickFallback, countConnectedProviders, pickFallbackModel } from '../ResilientRelay';
import { useProviderStore } from '../../../store/useProviderStore';
import { providerRegistry } from '../../ProviderRegistry';

function baseConfig(overrides: Partial<{ apiKey: string; model: string; enabled: boolean }> = {}) {
  return { apiKey: 'key', model: 'deepseek-v4-flash-free', enabled: true, ...overrides };
}

describe('ResilientRelay — model routing', () => {
  beforeAll(async () => {
    // providerRegistry populates its static/fallback model list lazily via
    // init() (normally called once at app startup) rather than in its
    // constructor — without this, getModels() returns [] for everyone.
    await providerRegistry.init();
  });

  beforeEach(() => {
    useProviderStore.setState({ providers: {}, activeProvider: 'opencode' });
  });

  describe('countConnectedProviders', () => {
    it('counts only enabled, credentialed providers', () => {
      useProviderStore.setState({
        providers: {
          opencode: baseConfig(),
          anthropic: baseConfig({ apiKey: '' }), // no key = not connected
          gemini: { ...baseConfig(), enabled: false }, // disabled = not connected
        },
      });
      expect(countConnectedProviders()).toBe(1);
    });

    it('counts multiple when more than one is genuinely connected', () => {
      useProviderStore.setState({
        providers: { opencode: baseConfig(), anthropic: baseConfig({ model: 'claude-x' }) },
      });
      expect(countConnectedProviders()).toBe(2);
    });
  });

  describe('pickFallbackModel', () => {
    it('finds another model offered by the same provider', () => {
      const model = pickFallbackModel('opencode', 'deepseek-v4-flash-free', []);
      expect(model).toBe('gpt-4o-mini');
    });

    it('excludes already-tried models', () => {
      const model = pickFallbackModel('opencode', 'deepseek-v4-flash-free', ['gpt-4o-mini']);
      expect(model).toBeNull();
    });
  });

  describe('pickFallback', () => {
    it('with only one provider connected, fails over to another model on the SAME provider, not a different provider', () => {
      useProviderStore.setState({
        providers: { opencode: baseConfig() },
        activeProvider: 'opencode',
      });

      const fallback = pickFallback('opencode', 'deepseek-v4-flash-free', ['opencode'], ['deepseek-v4-flash-free']);
      expect(fallback).not.toBeNull();
      expect(fallback!.sameProvider).toBe(true);
      expect(fallback!.provider).toBe('opencode');
      expect(fallback!.model).toBe('gpt-4o-mini');
    });

    it('with multiple providers connected, crosses to a different provider instead', () => {
      useProviderStore.setState({
        providers: {
          opencode: baseConfig(),
          anthropic: baseConfig({ model: 'claude-sonnet' }),
        },
        activeProvider: 'opencode',
      });

      const fallback = pickFallback('opencode', 'deepseek-v4-flash-free', ['opencode'], ['deepseek-v4-flash-free']);
      expect(fallback).not.toBeNull();
      expect(fallback!.sameProvider).toBe(false);
      expect(fallback!.provider).toBe('anthropic');
    });

    it('returns null when a single provider has no other models left to try', () => {
      useProviderStore.setState({
        providers: { opencode: baseConfig() },
        activeProvider: 'opencode',
      });
      const fallback = pickFallback(
        'opencode', 'gpt-4o-mini', ['opencode'], ['deepseek-v4-flash-free', 'gpt-4o-mini'],
      );
      expect(fallback).toBeNull();
    });
  });
});
