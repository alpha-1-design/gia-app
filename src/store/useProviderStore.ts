import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type ProviderType = 'openrouter' | 'anthropic' | 'openai' | 'gemini' | 'groq' | 'opencode';

export interface ModelOption {
  id: string;
  label: string;
  free: boolean;
  context?: string;
}

interface ProviderConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

// Default models per provider
export const PROVIDER_DEFAULTS: Record<ProviderType, { model: string; label: string; baseUrl: string }> = {
  openrouter: { model: 'google/gemma-3-27b-it:free', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  anthropic:  { model: 'claude-3-5-haiku-20241022',  label: 'Anthropic',  baseUrl: 'https://api.anthropic.com/v1' },
  openai:     { model: 'gpt-4o-mini',                label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1' },
  gemini:     { model: 'gemini-2.0-flash',           label: 'Gemini',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  groq:       { model: 'llama-3.3-70b-versatile',    label: 'Groq',       baseUrl: 'https://api.groq.com/openai/v1' },
  opencode:   { model: 'deepseek-chat',              label: 'OpenCode',   baseUrl: 'https://opencode.ai/zen/v1' },
};

// Static fallback model lists (used when API fetch fails or key not yet set)
export const STATIC_MODELS: Record<ProviderType, ModelOption[]> = {
  openrouter: [
    { id: 'google/gemma-3-27b-it:free',         label: 'Gemma 3 27B (Free)',       free: true,  context: '96k' },
    { id: 'meta-llama/llama-4-maverick:free',    label: 'Llama 4 Maverick (Free)',  free: true,  context: '128k' },
    { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Free)',       free: true,  context: '64k' },
    { id: 'google/gemini-2.0-flash-exp:free',    label: 'Gemini 2.0 Flash (Free)',  free: true,  context: '1M' },
    { id: 'anthropic/claude-3.5-haiku',          label: 'Claude 3.5 Haiku',         free: false, context: '200k' },
    { id: 'openai/gpt-4o-mini',                  label: 'GPT-4o Mini',              free: false, context: '128k' },
    { id: 'google/gemini-2.5-pro',               label: 'Gemini 2.5 Pro',           free: false, context: '1M' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',  free: false, context: '200k' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', free: false, context: '200k' },
    { id: 'claude-opus-4-5',            label: 'Claude Opus 4.5',   free: false, context: '200k' },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  free: false, context: '128k' },
    { id: 'gpt-4o',       label: 'GPT-4o',        free: false, context: '128k' },
    { id: 'o4-mini',      label: 'o4-mini',       free: false, context: '128k' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      free: false, context: '1M' },
    { id: 'gemini-2.5-pro-latest', label: 'Gemini 2.5 Pro',        free: false, context: '1M' },
    { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      free: false, context: '1M' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',    free: false, context: '128k' },
    { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Fast', free: false, context: '128k' },
    { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',     free: false, context: '32k' },
    { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',       free: false, context: '8k' },
  ],
  opencode: [
    { id: 'deepseek-chat',          label: 'DeepSeek Chat V3', free: false, context: '64k' },
    { id: 'deepseek-reasoner',      label: 'DeepSeek R1',      free: false, context: '64k' },
  ],
};

interface GiaProviderState {
  providers: Record<ProviderType, ProviderConfig>;
  availableModels: Record<ProviderType, ModelOption[]>;
  activeProvider: ProviderType;
  setProviderKey: (p: ProviderType, key: string) => void;
  setProviderModel: (p: ProviderType, model: string) => void;
  setActiveProvider: (p: ProviderType) => void;
  disconnectProvider: (p: ProviderType) => void;
  fetchModels: (p: ProviderType) => Promise<ModelOption[]>;
}

const buildDefaultProviders = (): Record<ProviderType, ProviderConfig> => {
  const result = {} as Record<ProviderType, ProviderConfig>;
  for (const [key, val] of Object.entries(PROVIDER_DEFAULTS)) {
    result[key as ProviderType] = { apiKey: '', model: val.model, enabled: false };
  }
  return result;
};

export const useProviderStore = create<GiaProviderState>()(
  persist(
    (set, get) => ({
      providers: buildDefaultProviders(),
      availableModels: { ...STATIC_MODELS },
      activeProvider: 'openrouter',

      setProviderKey: (p, key) =>
        set((s) => ({
          providers: { ...s.providers, [p]: { ...s.providers[p], apiKey: key, enabled: key.trim().length > 0 } },
        })),
      setProviderModel: (p, model) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...s.providers[p], model } } })),
      setActiveProvider: (p) => set({ activeProvider: p }),
      disconnectProvider: (p) =>
        set((s) => ({
          providers: { ...s.providers, [p]: { ...s.providers[p], apiKey: '', enabled: false } },
          availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] },
        })),

      fetchModels: async (p): Promise<ModelOption[]> => {
        const { providers } = get();
        const config = providers[p];
        if (!config.apiKey) return STATIC_MODELS[p];

        try {
          const { baseUrl } = PROVIDER_DEFAULTS[p];
          
          // Anthropic still doesn't have a standard public listing API for browser-side keys
          if (p === 'anthropic') {
            set((s) => ({ availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] } }));
            return STATIC_MODELS[p];
          }

          // Gemini specific listing
          if (p === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`);
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();
            const data = (json.models || []).filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
            const formatted: ModelOption[] = data.map((m: any) => ({
              id: m.name.split('/').pop(),
              label: m.displayName || m.name,
              free: true, // Gemini Flash models are usually free/low cost in beta
              context: m.inputTokenLimit ? `${Math.round(m.inputTokenLimit / 1000)}k` : '1M',
            }));
            set((s) => ({ availableModels: { ...s.availableModels, [p]: formatted } }));
            return formatted;
          }

          const res = await fetch(`${baseUrl}/models`, {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
              ...(p === 'openrouter' ? { 'HTTP-Referer': 'https://gia.app', 'X-Title': 'GIA' } : {}),
            },
          });
          if (!res.ok) throw new Error(`${res.status}`);
          const json = await res.json();
          const data: any[] = json.data ?? json.models ?? [];
          
          const formatted: ModelOption[] = data
            .filter((m) => m.id)
            .map((m) => {
              // OpenRouter/OpenCode specific pricing check
              let isFree = false;
              if (p === 'openrouter' || p === 'opencode') {
                const price = m.pricing || m.price;
                if (price) {
                  const promptPrice = parseFloat(price.prompt || price);
                  isFree = promptPrice === 0;
                } else if (m.id.includes(':free')) {
                  isFree = true;
                }
              } else if (p === 'groq') {
                isFree = false; // Groq is currently paid/tier based
              }

              return {
                id: m.id,
                label: m.name || m.id,
                free: isFree,
                context: m.context_length ? `${Math.round(m.context_length / 1000)}k` : m.id.includes('llama-3') ? '128k' : '?',
              };
            });

          const result = formatted.length > 0 ? formatted : STATIC_MODELS[p];
          
          // Sort free models to the top for OpenRouter
          if (p === 'openrouter') {
            result.sort((a, b) => (a.free === b.free ? 0 : a.free ? -1 : 1));
          }

          set((s) => ({ availableModels: { ...s.availableModels, [p]: result } }));
          return result;
        } catch (e) {
          console.error(`Fetch models failed for ${p}:`, e);
          set((s) => ({ availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] } }));
          return STATIC_MODELS[p];
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
