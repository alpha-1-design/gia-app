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

export interface ProviderConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
  baseUrl?: string;
  /** Overrides the provider's default image-generation model (e.g. dall-e-3). */
  imageModel?: string;
  tokenBalance?: number;
  tokenLimit?: number;
}

export interface PendingTask {
  id: string;
  agentId?: string;
  agentName?: string;
  prompt: string;
  sessionId: string;
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface GiaProviderState {
  providers: Record<string, ProviderConfig>;
  availableModels: Record<string, ModelOption[]>;
  /** Whether each provider's model list came from a live API fetch or the curated fallback catalog. */
  modelListStatus: Record<string, 'live' | 'catalog'>;
  activeProvider: string;
  initialised: boolean;
  pendingTasks: PendingTask[];
  setProviderKey: (p: string, key: string) => void;
  setProviderModel: (p: string, model: string) => void;
  setProviderImageModel: (p: string, model: string) => void;
  setActiveProvider: (p: string) => void;
  setProviderBaseUrl: (p: string, url: string) => void;
  setProviderTokenBalance: (p: string, balance: number) => void;
  setProviderTokenLimit: (p: string, limit: number) => void;
  deductTokens: (p: string, amount: number) => void;
  getActiveProviders: () => { id: string; config: ProviderConfig }[];
  getBestProviderForTask: () => { id: string; config: ProviderConfig } | null;
  disconnectProvider: (p: string) => void;
  fetchModels: (p: string) => Promise<ModelOption[]>;
  loadProviders: () => Promise<void>;
  addPendingTask: (task: Omit<PendingTask, 'id' | 'createdAt' | 'status'>) => string;
  removePendingTask: (id: string) => void;
  processPendingTasks: () => Promise<void>;
}

function getActiveProvidersFromState(providers: Record<string, ProviderConfig>): { id: string; config: ProviderConfig }[] {
  return Object.entries(providers)
    .filter(([, cfg]) => cfg.enabled && cfg.apiKey && cfg.apiKey.trim().length > 0)
    .map(([id, config]) => ({ id, config }));
}

function getBestProviderFromState(providers: Record<string, ProviderConfig>): { id: string; config: ProviderConfig } | null {
  const active = getActiveProvidersFromState(providers);
  if (active.length === 0) return null;
  // Sort by token balance descending — pick the one with most tokens left
  active.sort((a, b) => {
    const aBal = a.config.tokenBalance ?? Infinity;
    const bBal = b.config.tokenBalance ?? Infinity;
    if (aBal !== bBal) return bBal - aBal;
    return 0;
  });
  return active[0];
}

export const useProviderStore = create<GiaProviderState>()(
  persist(
    (set, get) => ({
      providers: {},
      availableModels: {},
      modelListStatus: {},
      activeProvider: 'opencode',
      initialised: false,
      pendingTasks: [],

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

      setProviderImageModel: (p, model) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...(s.providers[p] || { apiKey: '', enabled: false, model: providerRegistry.getDefaultModel(p) }), imageModel: model.trim() || undefined } } })),

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
            modelListStatus: { ...s.modelListStatus, [p]: 'catalog' as const },
          };
        }),

      fetchModels: async (p): Promise<ModelOption[]> => {
        const { providers } = get();
        const config = providers[p];
        const def = providerRegistry.getProvider(p);
        if (!def) return [];

        const markLive = (list: ModelOption[]): ModelOption[] => {
          set((s) => ({ availableModels: { ...s.availableModels, [p]: list }, modelListStatus: { ...s.modelListStatus, [p]: 'live' as const } }));
          return list;
        };
        const markCatalog = (list: ModelOption[]): ModelOption[] => {
          set((s) => ({ availableModels: { ...s.availableModels, [p]: list }, modelListStatus: { ...s.modelListStatus, [p]: 'catalog' as const } }));
          return list;
        };

        const isPublicListingSupported = p === 'opencode' || p === 'openrouter';
        if (!config?.apiKey && def.needsApiKey && !isPublicListingSupported) {
          return markCatalog(providerRegistry.getModels(p));
        }

        const baseUrl = config?.baseUrl || def.baseUrl;
        const listingType = def.listingType;
        const isLocal = !def.needsApiKey && (p === 'ollama' || p === 'lmstudio');

        try {
          // Providers without dynamic listing
          if (listingType === 'huggingface' || listingType === 'local') {
            return markCatalog(providerRegistry.getModels(p));
          }

          // Anthropic supports CORS from the browser via the dangerous-direct-browser-access
          // header (enabled Aug 2024). So we CAN list models live instead of a static fallback.
          if (listingType === 'anthropic') {
            try {
              const res = await corsProxy.fetch('https://api.anthropic.com/v1/models', {
                signal: AbortSignal.timeout(8000),
                headers: {
                  'x-api-key': config.apiKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true',
                },
              });
              if (!res.ok) throw new Error(`${res.status}`);
              const json: { data?: { id: string; display_name?: string; type?: string }[] } = await res.json();
              const data = (json.data || []).filter((m) => m.type === 'model');
              if (data.length > 0) {
                const formatted: ModelOption[] = data.map((m) => ({
                  id: m.id,
                  label: m.display_name || m.id,
                  free: false,
                  context: '200k',
                  tools: true,
                  vision: true,
                }));
                formatted.sort((a, b) => b.id.localeCompare(a.id));
                return markLive(formatted);
              }
            } catch (e) {
              logger.warn(`[fetchModels] Anthropic live listing failed, using curated catalog:`, e);
            }
            return markCatalog(providerRegistry.getModels(p));
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
                  return markLive(data);
                }
              }
            } catch { /* fallback */ }
            return markCatalog(providerRegistry.getModels(p));
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
                  return markLive(data);
                }
              }
            } catch { /* fallback */ }
            return markCatalog(providerRegistry.getModels(p));
          }

          // Gemini listing — use header auth to avoid exposing API key through CORS proxy
          if (listingType === 'gemini') {
            const res = await corsProxy.fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
              signal: AbortSignal.timeout(8000),
              headers: { 'x-goog-api-key': config.apiKey },
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const json: { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }[] } = await res.json();
            const data = (json.models || []).filter((m) => m.supportedGenerationMethods?.includes('generateContent'));
            const formatted: ModelOption[] = data.map((m) => ({
              id: m.name.split('/').pop() ?? m.name,
              label: m.displayName || m.name,
              free: true,
              context: m.inputTokenLimit ? `${Math.round(m.inputTokenLimit / 1000)}k` : '1M',
            }));
            return markLive(formatted);
          }

          // OpenAI-compatible listing
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (config?.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
          }
          if (def.headers) Object.assign(headers, def.headers);

          const fetchFn = isLocal ? fetch : (url: string, init?: RequestInit) => corsProxy.fetch(url, init);
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

          return markLive(result);
        } catch (e) {
          logger.warn(`Fetch models failed for ${p}:`, e);
          return markCatalog(providerRegistry.getModels(p));
        }
      },

      setProviderTokenBalance: (p, balance) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...s.providers[p], tokenBalance: balance } } })),

      setProviderTokenLimit: (p, limit) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...s.providers[p], tokenLimit: limit } } })),

      deductTokens: (p, amount) => {
        const config = get().providers[p];
        if (!config) return;
        const current = config.tokenBalance ?? Infinity;
        if (current === Infinity) return; // Unlimited — no tracking
        const remaining = Math.max(0, current - amount);
        set((s) => ({ providers: { ...s.providers, [p]: { ...s.providers[p], tokenBalance: remaining } } }));
      },

      getActiveProviders: () => getActiveProvidersFromState(get().providers),

      getBestProviderForTask: () => getBestProviderFromState(get().providers),

      addPendingTask: (task) => {
        const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const pending: PendingTask = { ...task, id, createdAt: Date.now(), status: 'pending' };
        set((s) => ({ pendingTasks: [...s.pendingTasks, pending] }));
        return id;
      },

      removePendingTask: (id) =>
        set((s) => ({ pendingTasks: s.pendingTasks.filter(t => t.id !== id) })),

      processPendingTasks: async () => {
        const { pendingTasks, getBestProviderForTask } = get();
        const best = getBestProviderForTask();
        if (!best || pendingTasks.length === 0) return;
        // Process one task at a time — emit event for useChatGeneration to pick up
        const task = pendingTasks.find(t => t.status === 'pending');
        if (!task) return;
        set((s) => ({ pendingTasks: s.pendingTasks.map(t => t.id === task.id ? { ...t, status: 'running' } : t) }));
        // Dispatch a custom event for the UI to handle
        window.dispatchEvent(new CustomEvent('gia:pending-task-ready', { detail: task }));
      },
    }),
    {
      name: 'gia-provider-storage-v2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ providers: s.providers, activeProvider: s.activeProvider, pendingTasks: s.pendingTasks }),
    }
  )
);
