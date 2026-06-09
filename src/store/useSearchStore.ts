import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export interface SearchProviderConfig {
  apiKey: string;
  enabled: boolean;
  label: string;
}

export type SearchProviderId = 'exa' | 'browserless' | 'none';

interface SearchState {
  activeSearchProvider: SearchProviderId;
  providers: Record<SearchProviderId, SearchProviderConfig>;
  setActiveSearchProvider: (id: SearchProviderId) => void;
  setSearchProviderKey: (id: SearchProviderId, key: string) => void;
  setSearchProviderEnabled: (id: SearchProviderId, enabled: boolean) => void;
  getActiveKey: () => string;
  hasActiveProvider: () => boolean;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      activeSearchProvider: 'none',
      providers: {
        exa: { apiKey: '', enabled: false, label: 'Exa Search' },
        browserless: { apiKey: '', enabled: false, label: 'Browserless.io' },
        none: { apiKey: '', enabled: true, label: 'No API — use fallback scraping' },
      },

      setActiveSearchProvider: (id) => set({ activeSearchProvider: id }),

      setSearchProviderKey: (id, key) => set((s) => ({
        providers: { ...s.providers, [id]: { ...s.providers[id], apiKey: key } },
      })),

      setSearchProviderEnabled: (id, enabled) => set((s) => ({
        providers: { ...s.providers, [id]: { ...s.providers[id], enabled } },
      })),

      getActiveKey: () => {
        const s = get();
        const active = s.providers[s.activeSearchProvider];
        return active?.apiKey || '';
      },

      hasActiveProvider: () => {
        const s = get();
        if (s.activeSearchProvider === 'none') return false;
        const active = s.providers[s.activeSearchProvider];
        return active?.enabled && !!active.apiKey;
      },
    }),
    {
      name: 'gia-search-providers',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        activeSearchProvider: s.activeSearchProvider,
        providers: {
          exa: { apiKey: s.providers.exa.apiKey, enabled: s.providers.exa.enabled, label: s.providers.exa.label },
          browserless: { apiKey: s.providers.browserless.apiKey, enabled: s.providers.browserless.enabled, label: s.providers.browserless.label },
          none: s.providers.none,
        },
      }),
    }
  )
);
