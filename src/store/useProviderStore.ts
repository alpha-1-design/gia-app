import { logger } from '../utils/logger';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { providerRegistry } from '../services/ProviderRegistry';
import { corsProxy } from '../services/CorsProxy';

export type ProviderType = string;

export interface ModelOption {
  id: string;
  label: string;
  free: boolean;
  context?: string;
  tools?: boolean;
  vision?: boolean;
}

interface ProviderConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
  baseUrl?: string;
}

interface GiaProviderState {
  providers: Record<string, ProviderConfig>;
  availableModels: Record<string, ModelOption[]>;
  activeProvider: string;
  initialised: boolean;
  setProviderKey: (p: string, key: string) => void;
  setProviderModel: (p: string, model: string) => void;
  setActiveProvider: (p: string) => void;
  setProviderBaseUrl: (p: string, url: string) => void;
  disconnectProvider: (p: string) => void;
  fetchModels: (p: string) => Promise<ModelOption[]>;
  loadProviders: () => Promise<void>;
}

export const useProviderStore = create<GiaProviderState>()(
  persist(
    (set, get) => ({
      providers: {},
      availableModels: {},
      activeProvider: 'opencode',
      initialised: false,

      loadProviders: async () => {
        await providerRegistry.ensureLoaded();
        const ids = providerRegistry.getAllIds();
        set((s) => {
          const providers = { ...s.providers };
          const availableModels = { ...s.availableModels };
          for (const id of ids) {
            if (!providers[id]) {
              providers[id] = {
                apiKey: '',
                model: providerRegistry.getDefaultModel(id),
                enabled: false,
                baseUrl: providerRegistry.getProvider(id)?.baseUrl,
              };
            }
            if (!availableModels[id] || availableModels[id].length === 0) {
              availableModels[id] = providerRegistry.getModels(id);
            }
          }
          // Remove stale providers that no longer exist
          for (const key of Object.keys(providers)) {
            if (!ids.includes(key)) {
              delete providers[key];
              delete availableModels[key];
            }
          }
          let activeProvider = s.activeProvider;
          if (!providers[activeProvider]) {
            activeProvider = ids[0] || 'opencode';
          }
          return { providers, availableModels, activeProvider, initialised: true };
        });
      },

      setProviderKey: (p, key) =>
        set((s) => {
          const needsKey = providerRegistry.getNeedsApiKey(p);
          const enabled = needsKey ? key.trim().length > 0 : true;
          const providers = { ...s.providers, [p]: { ...(s.providers[p] || { model: providerRegistry.getDefaultModel(p), enabled: false }), apiKey: key, enabled } };
          const activeProvider = enabled && !s.providers[p]?.enabled ? p : s.activeProvider;
          return { providers, activeProvider };
        }),

      setProviderModel: (p, model) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...(s.providers[p] || { apiKey: '', enabled: false }), model } } })),

      setActiveProvider: (p) => set({ activeProvider: p }),

      setProviderBaseUrl: (p, url) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...(s.providers[p] || { apiKey: '', enabled: false, model: providerRegistry.getDefaultModel(p) }), baseUrl: url } } })),

      disconnectProvider: (p) =>
        set((s) => {
          const providers = { ...s.providers, [p]: { ...s.providers[p], apiKey: '', enabled: false } };
          let activeProvider = s.activeProvider;
          if (p === s.activeProvider) {
            const fallback = Object.entries(providers).find(([, cfg]) => cfg.enabled && cfg.apiKey);
            activeProvider = fallback ? fallback[0] : 'opencode';
          }
          return {
            providers,
            activeProvider,
            availableModels: { ...s.availableModels, [p]: providerRegistry.getModels(p) },
          };
        }),

      fetchModels: async (p): Promise<ModelOption[]> => {
        const { providers } = get();
        const config = providers[p];
        const def = providerRegistry.getProvider(p);
        if (!def) return [];

        if (!config?.apiKey && def.needsApiKey) {
          return providerRegistry.getModels(p);
        }

        const baseUrl = config?.baseUrl || def.baseUrl;
        const listingType = def.listingType;
        const isLocal = !def.needsApiKey && (p === 'ollama' || p === 'lmstudio');

        try {
          // Providers without dynamic listing
          if (listingType === 'anthropic' || listingType === 'huggingface') {
            set((s) => ({ availableModels: { ...s.availableModels, [p]: providerRegistry.getModels(p) } }));
            return providerRegistry.getModels(p);
          }

          // Ollama local listing
          if (listingType === 'ollama') {
            try {
              const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(5000) });
              if (res.ok) {
                const json: { models?: { name: string; details?: { parameter_size?: string } }[] } = await res.json();
                const data = (json.models || []).map((m) => ({
                  id: m.name,
                  label: m.name,
                  free: true,
                  context: m.details?.parameter_size || '?',
                  tools: true,
                  vision: m.name?.toLowerCase().includes('vision') || false,
                }));
                if (data.length > 0) {
                  set((s) => ({ availableModels: { ...s.availableModels, [p]: data } }));
                  return data;
                }
              }
            } catch { /* fallback */ }
            set((s) => ({ availableModels: { ...s.availableModels, [p]: providerRegistry.getModels(p) } }));
            return providerRegistry.getModels(p);
          }

          // LM Studio local listing (OpenAI-compatible /models endpoint)
          if (p === 'lmstudio') {
            try {
              const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(5000) });
              if (res.ok) {
                const json: { data?: { id: string; name?: string; context_length?: number }[] } = await res.json();
                const apiData = json.data || [];
                if (apiData.length > 0) {
                  const data = apiData.map((m) => ({
                    id: m.id,
                    label: m.name || m.id,
                    free: true,
                    context: m.context_length ? `${Math.round(m.context_length / 1000)}k` : '?',
                    tools: true,
                    vision: /vision|pixtral|llava|vl/i.test(m.id),
                  }));
                  set((s) => ({ availableModels: { ...s.availableModels, [p]: data } }));
                  return data;
                }
              }
            } catch { /* fallback */ }
            set((s) => ({ availableModels: { ...s.availableModels, [p]: providerRegistry.getModels(p) } }));
            return providerRegistry.getModels(p);
          }

          // Gemini listing
          if (listingType === 'gemini') {
            const res = await corsProxy.fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) throw new Error(`${res.status}`);
            const json: { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[] } = await res.json();
            const data = (json.models || []).filter((m) => m.supportedGenerationMethods?.includes('generateContent'));
            const formatted: ModelOption[] = data.map((m) => ({
              id: m.name.split('/').pop() ?? m.name,
              label: m.displayName || m.name,
              free: true,
              context: m.inputTokenLimit ? `${Math.round(m.inputTokenLimit / 1000)}k` : '1M',
            }));
            set((s) => ({ availableModels: { ...s.availableModels, [p]: formatted } }));
            return formatted;
          }

          // OpenAI-compatible listing
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
          }
          if (def.headers) Object.assign(headers, def.headers);

          const fetchFn = isLocal ? fetch : corsProxy.fetch;
          const res = await fetchFn(`${baseUrl}/models`, {
            headers,
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) throw new Error(`${res.status}`);
          const json: {
            data?: { id: string; name?: string; pricing?: { prompt?: string } | string; context_length?: number }[];
            models?: { id: string; name?: string; pricing?: { prompt?: string } | string; context_length?: number }[];
          } = await res.json();
          const apiData = json.data ?? json.models ?? [];

          const fallbackModels = providerRegistry.getModels(p);
          const formatted: ModelOption[] = apiData
            .filter((m) => m.id)
            .map((m) => {
              const staticDef = fallbackModels.find(sm => sm.id === m.id);
              let isFree = staticDef?.free ?? false;
              const price = (m as { pricing?: { prompt?: string } | string }).pricing;
              if (price) {
                const promptPrice = parseFloat(typeof price === 'string' ? price : (price.prompt || '0'));
                isFree = !isNaN(promptPrice) && promptPrice === 0;
              }
              return {
                id: m.id,
                label: m.name || m.id,
                free: isFree,
                context: m.context_length ? `${Math.round(m.context_length / 1000)}k` : '?',
                tools: staticDef?.tools,
                vision: staticDef?.vision || /vision|pixtral|llava|vl/i.test(m.id),
              };
            });

          const result = formatted.length > 0 ? formatted : fallbackModels;
          result.sort((a, b) => {
            if (a.free !== b.free) return a.free ? -1 : 1;
            if ((a.vision || false) !== (b.vision || false)) return a.vision ? -1 : 1;
            return 0;
          });

          set((s) => ({ availableModels: { ...s.availableModels, [p]: result } }));
          return result;
        } catch (e) {
          logger.error(`Fetch models failed for ${p}:`, e);
          set((s) => ({ availableModels: { ...s.availableModels, [p]: providerRegistry.getModels(p) } }));
          return providerRegistry.getModels(p);
        }
      },
    }),
    {
      name: 'gia-provider-storage-v2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ providers: s.providers, activeProvider: s.activeProvider }),
    }
  )
);
