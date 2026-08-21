import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { useSearchStore } from '../useSearchStore';

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      activeSearchProvider: 'none',
      providers: {
        exa: { apiKey: '', enabled: false, label: 'Exa Search' },
        browserless: { apiKey: '', enabled: false, label: 'Browserless.io' },
        none: { apiKey: '', enabled: true, label: 'No API' },
      },
    });
  });

  describe('setSearchProviderKey', () => {
    it('stores API key for exa', () => {
      useSearchStore.getState().setSearchProviderKey('exa', 'exa-key-123');
      expect(useSearchStore.getState().providers.exa.apiKey).toBe('exa-key-123');
    });

    it('stores API key for browserless', () => {
      useSearchStore.getState().setSearchProviderKey('browserless', 'bl-key');
      expect(useSearchStore.getState().providers.browserless.apiKey).toBe('bl-key');
    });

    it('does not affect other providers', () => {
      useSearchStore.getState().setSearchProviderKey('exa', 'key');
      expect(useSearchStore.getState().providers.browserless.apiKey).toBe('');
    });
  });

  describe('setSearchProviderEnabled', () => {
    it('enables a provider', () => {
      useSearchStore.getState().setSearchProviderEnabled('exa', true);
      expect(useSearchStore.getState().providers.exa.enabled).toBe(true);
    });

    it('disables a provider', () => {
      useSearchStore.getState().setSearchProviderEnabled('exa', true);
      useSearchStore.getState().setSearchProviderEnabled('exa', false);
      expect(useSearchStore.getState().providers.exa.enabled).toBe(false);
    });
  });

  describe('setActiveSearchProvider', () => {
    it('sets active provider', () => {
      useSearchStore.getState().setActiveSearchProvider('exa');
      expect(useSearchStore.getState().activeSearchProvider).toBe('exa');
    });

    it('can reset to none', () => {
      useSearchStore.getState().setActiveSearchProvider('exa');
      useSearchStore.getState().setActiveSearchProvider('none');
      expect(useSearchStore.getState().activeSearchProvider).toBe('none');
    });
  });

  describe('getActiveKey', () => {
    it('returns empty when no provider is active', () => {
      expect(useSearchStore.getState().getActiveKey()).toBe('');
    });

    it('returns key when active provider has one', () => {
      useSearchStore.getState().setSearchProviderKey('exa', 'exa-key');
      useSearchStore.getState().setActiveSearchProvider('exa');
      expect(useSearchStore.getState().getActiveKey()).toBe('exa-key');
    });

    it('returns empty when active provider has no key', () => {
      useSearchStore.getState().setActiveSearchProvider('exa');
      expect(useSearchStore.getState().getActiveKey()).toBe('');
    });
  });

  describe('hasActiveProvider', () => {
    it('returns false when active is none', () => {
      expect(useSearchStore.getState().hasActiveProvider()).toBe(false);
    });

    it('returns false when provider not enabled', () => {
      useSearchStore.getState().setSearchProviderKey('exa', 'key');
      useSearchStore.getState().setActiveSearchProvider('exa');
      // exa is not enabled
      expect(useSearchStore.getState().hasActiveProvider()).toBe(false);
    });

    it('returns true when provider is enabled and has key', () => {
      useSearchStore.getState().setSearchProviderKey('exa', 'key');
      useSearchStore.getState().setSearchProviderEnabled('exa', true);
      useSearchStore.getState().setActiveSearchProvider('exa');
      expect(useSearchStore.getState().hasActiveProvider()).toBe(true);
    });
  });

  describe('bidirectional sync with AI tool', () => {
    it('keys set via AI tool are visible in the same store that Settings reads', () => {
      // Simulate what search_provider_configure tool does
      const store = useSearchStore.getState();
      store.setSearchProviderKey('exa', 'ai-configured-key');
      store.setSearchProviderEnabled('exa', true);
      store.setActiveSearchProvider('exa');

      // Now read it back the way the Settings screen would
      const settingsStore = useSearchStore.getState();
      expect(settingsStore.providers.exa.apiKey).toBe('ai-configured-key');
      expect(settingsStore.providers.exa.enabled).toBe(true);
      expect(settingsStore.activeSearchProvider).toBe('exa');
      expect(settingsStore.hasActiveProvider()).toBe(true);
    });
  });
});
