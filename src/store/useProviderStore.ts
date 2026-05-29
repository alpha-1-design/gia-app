import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type ProviderType = 'openrouter' | 'anthropic' | 'openai' | 'gemini' | 'groq' | 'opencode' | 'deepseek' | 'cerebras' | 'mistral' | 'huggingface' | 'ollama';

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
}

// Default models per provider
export const PROVIDER_DEFAULTS: Record<ProviderType, { model: string; label: string; baseUrl: string }> = {
  openrouter: { model: 'google/gemma-3-27b-it:free', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  anthropic:  { model: 'claude-3-5-haiku-20241022',  label: 'Anthropic',  baseUrl: 'https://api.anthropic.com/v1' },
  openai:     { model: 'gpt-4o-mini',                label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1' },
  gemini:     { model: 'gemini-2.0-flash',           label: 'Gemini',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  groq:       { model: 'llama-3.3-70b-versatile',    label: 'Groq',       baseUrl: 'https://api.groq.com/openai/v1' },
  opencode:   { model: 'deepseek-chat',              label: 'OpenCode',   baseUrl: 'https://opencode.ai/zen/v1' },
  deepseek:   { model: 'deepseek-chat',              label: 'DeepSeek',   baseUrl: 'https://api.deepseek.com/v1' },
  cerebras:   { model: 'llama-3.1-8b',               label: 'Cerebras',   baseUrl: 'https://api.cerebras.ai/v1' },
  mistral:    { model: 'mistral-small-latest',        label: 'Mistral',    baseUrl: 'https://api.mistral.ai/v1' },
  huggingface: { model: 'microsoft/Phi-4-mini-instruct', label: 'HuggingFace', baseUrl: 'https://api-inference.huggingface.co/v1' },
  ollama: { model: 'llama3.2', label: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1' },
};

// Static fallback model lists (used when API fetch fails or key not yet set)
export const STATIC_MODELS: Record<ProviderType, ModelOption[]> = {
  openrouter: [
    { id: 'google/gemma-3-27b-it:free',         label: 'Gemma 3 27B',       free: true,  context: '96k',  tools: true,  vision: true  },
    { id: 'meta-llama/llama-4-maverick:free',    label: 'Llama 4 Maverick',  free: true,  context: '128k', tools: true,  vision: true  },
    { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3',       free: true,  context: '64k',  tools: true,  vision: true  },
    { id: 'google/gemini-2.0-flash-exp:free',    label: 'Gemini 2.0 Flash',  free: true,  context: '1M',   tools: true,  vision: true  },
    { id: 'qwen/qwq-32b:free',                  label: 'QwQ 32B',           free: true,  context: '32k',  tools: true,  vision: false },
    { id: 'cognitivecomputations/dolphin3.0-r1-mistral-24b:free', label: 'Dolphin R1 24B', free: true, context: '32k', tools: true, vision: false },
    { id: 'microsoft/phi-4:free',               label: 'Phi-4 14B',         free: true,  context: '16k',  tools: true,  vision: false },
    { id: 'sophosympatheia/rogue-rose-103b-v0.2:free', label: 'Rogue Rose 103B', free: true, context: '32k', tools: true, vision: false },
    { id: 'nvidia/llama-3.1-nemotron-ultra:free',label: 'Nemotron Ultra',     free: true,  context: '256k', tools: true, vision: false },
    { id: 'anthropic/claude-3.5-haiku',          label: 'Claude 3.5 Haiku',   free: false, context: '200k', tools: true, vision: true  },
    { id: 'openai/gpt-4o-mini',                  label: 'GPT-4o Mini',        free: false, context: '128k', tools: true, vision: true  },
    { id: 'google/gemini-2.5-pro',               label: 'Gemini 2.5 Pro',     free: false, context: '1M',   tools: true, vision: true  },
    { id: 'openai/o3-mini',                      label: 'o3 Mini',            free: false, context: '200k', tools: true, vision: false },
    { id: 'mistralai/mistral-nemo',              label: 'Mistral Nemo',       free: false, context: '128k', tools: true, vision: true  },
    { id: 'ai21/jamba-1.6',                      label: 'Jamba 1.6',          free: false, context: '256k', tools: true, vision: false },
    { id: 'x-ai/grok-2',                         label: 'Grok 2',             free: false, context: '128k', tools: true, vision: true  },
    { id: 'cohere/command-r-plus',               label: 'Command R+',         free: false, context: '128k', tools: true, vision: false },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku',  free: false, context: '200k', tools: true, vision: true },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', free: false, context: '200k', tools: true, vision: true },
    { id: 'claude-opus-4-5',            label: 'Claude Opus 4.5',   free: false, context: '200k', tools: true, vision: true },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  free: false, context: '128k', tools: true, vision: true  },
    { id: 'gpt-4o',       label: 'GPT-4o',        free: false, context: '128k', tools: true, vision: true  },
    { id: 'o4-mini',      label: 'o4-mini',       free: false, context: '128k', tools: true, vision: true  },
  ],
  gemini: [
    { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      free: false, context: '1M', tools: true, vision: true },
    { id: 'gemini-2.5-pro-latest', label: 'Gemini 2.5 Pro',        free: false, context: '1M', tools: true, vision: true },
    { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      free: false, context: '1M', tools: true, vision: true },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',    free: false, context: '128k', tools: true, vision: false },
    { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Fast', free: false, context: '128k', tools: true, vision: false },
    { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',     free: false, context: '32k',  tools: true, vision: false },
    { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',       free: false, context: '8k',   tools: true, vision: false },
  ],
  opencode: [
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',     free: false, context: '200k', tools: true, vision: true  },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',   free: false, context: '200k', tools: true, vision: true  },
    { id: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5',    free: false, context: '200k', tools: true, vision: true  },
    { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash',    free: false, context: '1M',   tools: true, vision: true  },
    { id: 'gpt-4o-mini',               label: 'GPT-4o Mini',         free: false, context: '128k', tools: true, vision: true  },
    { id: 'deepseek-v4-flash-free',    label: 'DeepSeek V4 Flash',   free: true,  context: '64k',  tools: true, vision: true  },
    { id: 'qwen3.6-plus-free',         label: 'Qwen 3.6 Plus',       free: true,  context: '128k', tools: true, vision: true  },
    { id: 'minimax-m2.5-free',         label: 'MiniMax M2.5',        free: true,  context: '128k', tools: true, vision: true  },
    { id: 'nemotron-3-super-free',     label: 'Nemotron 3 Super',    free: true,  context: '256k', tools: true, vision: false },
    { id: 'mimo-v2.5-free',            label: 'Mimo 2.5',            free: true,  context: '128k', tools: true, vision: true  },
  ],
  deepseek: [
    { id: 'deepseek-chat',          label: 'DeepSeek Chat V3', free: false, context: '64k', tools: true, vision: true  },
    { id: 'deepseek-reasoner',      label: 'DeepSeek R1',      free: false, context: '64k', tools: true, vision: false },
  ],
  cerebras: [
    { id: 'llama-3.1-8b',                 label: 'Llama 3.1 8B',       free: true, context: '131k', tools: true, vision: false },
    { id: 'llama-3.1-70b',                label: 'Llama 3.1 70B',      free: true, context: '131k', tools: true, vision: false },
    { id: 'llama-3.3-70b',                label: 'Llama 3.3 70B',      free: true, context: '131k', tools: true, vision: false },
  ],
  mistral: [
    { id: 'mistral-small-latest',   label: 'Mistral Small',    free: true,  context: '32k',  tools: true, vision: false },
    { id: 'mistral-large-latest',   label: 'Mistral Large',    free: false, context: '128k', tools: true, vision: false },
    { id: 'pixtral-large-latest',   label: 'Pixtral Large',    free: false, context: '128k', tools: true, vision: true  },
  ],
  huggingface: [
    { id: 'microsoft/Phi-4-mini-instruct',              label: 'Phi-4 Mini',            free: true,  context: '16k',  tools: true,  vision: false },
    { id: 'microsoft/Phi-4',                            label: 'Phi-4 14B',             free: true,  context: '16k',  tools: true,  vision: false },
    { id: 'HuggingFaceH4/zephyr-7b-beta',               label: 'Zephyr 7B',             free: true,  context: '8k',   tools: false, vision: false },
    { id: 'meta-llama/Llama-3.2-11B-Vision-Instruct',   label: 'Llama 3.2 11B Vision',  free: false, context: '128k', tools: true,  vision: true  },
    { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct',   label: 'Llama 3.2 90B Vision',  free: false, context: '128k', tools: true,  vision: true  },
    { id: 'mistralai/Pixtral-12B-2409',                 label: 'Pixtral 12B',           free: false, context: '128k', tools: true,  vision: true  },
    { id: 'Qwen/Qwen2.5-Coder-32B-Instruct',            label: 'Qwen 2.5 Coder 32B',    free: false, context: '32k',  tools: true,  vision: false },
    { id: 'google/gemma-2-27b-it',                      label: 'Gemma 2 27B',           free: false, context: '8k',   tools: true,  vision: false },
    { id: 'microsoft/Phi-4-multimodal-instruct',        label: 'Phi-4 Multimodal',      free: true,  context: '16k',  tools: true,  vision: true  },
    { id: 'Qwen/Qwen2.5-72B-Instruct',                  label: 'Qwen 2.5 72B',          free: false, context: '128k', tools: true,  vision: false },
    { id: 'microsoft/Phi-3.5-mini-instruct',            label: 'Phi-3.5 Mini',          free: true,  context: '128k', tools: true,  vision: false },
    { id: 'NousResearch/Hermes-3-Llama-3.1-8B',         label: 'Hermes 3 8B',           free: true,  context: '128k', tools: true,  vision: false },
  ],
  ollama: [
    { id: 'llama3.2',           label: 'Llama 3.2',           free: true, context: '128k', tools: true, vision: false },
    { id: 'llama3.1',           label: 'Llama 3.1',           free: true, context: '128k', tools: true, vision: false },
    { id: 'mistral',            label: 'Mistral',             free: true, context: '32k',  tools: true, vision: false },
    { id: 'gemma3',             label: 'Gemma 3',             free: true, context: '128k', tools: true, vision: true  },
    { id: 'qwen2.5',            label: 'Qwen 2.5',            free: true, context: '128k', tools: true, vision: false },
    { id: 'phi4',               label: 'Phi-4',               free: true, context: '16k',  tools: true, vision: false },
    { id: 'deepseek-r1',        label: 'DeepSeek R1',         free: true, context: '128k', tools: true, vision: false },
    { id: 'codellama',          label: 'Code Llama',          free: true, context: '16k',  tools: true, vision: false },
    { id: 'llama3.2-vision',    label: 'Llama 3.2 Vision',    free: true, context: '128k', tools: true, vision: true  },
    { id: 'mistral-nemo',       label: 'Mistral Nemo',        free: true, context: '128k', tools: true, vision: false },
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
        set((s) => {
          // Ollama doesn't need an API key (local server)
          const needsKey = p !== 'ollama';
          const enabled = needsKey ? key.trim().length > 0 : true;
          const providers = { ...s.providers, [p]: { ...s.providers[p], apiKey: key, enabled } };
          // Auto-switch to this provider if it's newly enabled and no other provider is active
          const activeProvider = enabled && !s.providers[p].enabled
            ? p
            : s.activeProvider;
          return { providers, activeProvider };
        }),
      setProviderModel: (p, model) =>
        set((s) => ({ providers: { ...s.providers, [p]: { ...s.providers[p], model } } })),
      setActiveProvider: (p) => set({ activeProvider: p }),
      disconnectProvider: (p) =>
        set((s) => {
          const providers = { ...s.providers, [p]: { ...s.providers[p], apiKey: '', enabled: false } };
          let activeProvider = s.activeProvider;
          if (p === s.activeProvider) {
            const fallback = (Object.entries(providers) as [ProviderType, ProviderConfig][])
              .find(([, cfg]) => cfg.enabled && cfg.apiKey);
            activeProvider = fallback ? fallback[0] : 'openrouter';
          }
          return {
            providers,
            activeProvider,
            availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] },
          };
        }),

      fetchModels: async (p): Promise<ModelOption[]> => {
        const { providers } = get();
        const config = providers[p];
        // Ollama can work without an API key (local server)
        if (!config.apiKey && p !== 'ollama') return STATIC_MODELS[p];

        try {
          const { baseUrl } = PROVIDER_DEFAULTS[p];
          
          // Anthropic still doesn't have a standard public listing API for browser-side keys
          if (p === 'anthropic') {
            set((s) => ({ availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] } }));
            return STATIC_MODELS[p];
          }

          // HuggingFace Inference API also lacks a public model listing endpoint
          if (p === 'huggingface') {
            set((s) => ({ availableModels: { ...s.availableModels, [p]: STATIC_MODELS[p] } }));
            return STATIC_MODELS[p];
          }

          // Ollama uses a different API endpoint for model listing
          if (p === 'ollama') {
            try {
              const res = await fetch('http://localhost:11434/api/tags');
              if (res.ok) {
                const json = await res.json();
                const data = (json.models || []).map((m: any) => ({
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
            } catch {}
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
              // Inherit capabilities from static model definitions if available
              const staticModel = STATIC_MODELS[p]?.find(sm => sm.id === m.id);
              let isFree = staticModel?.free ?? false;
              let tools = staticModel?.tools;
              let vision = staticModel?.vision;

              // Provider-specific pricing detection
              if (p === 'openrouter' || p === 'opencode') {
                const price = m.pricing || m.price;
                if (price) {
                  const promptPrice = parseFloat(price.prompt || price);
                  isFree = promptPrice === 0;
                } else if (m.id.includes(':free')) {
                  isFree = true;
                }
              } else if (p === 'groq') {
                // Groq has free tier for some models
                isFree = m.id.includes('8b') || m.id.includes('gemma') || m.id.includes('mixtral');
              } else if (p === 'mistral') {
                isFree = m.id.includes('small') || m.id.includes('tiny');
              } else if (p === 'deepseek') {
                isFree = m.id.includes('chat') && !m.id.includes('pro');
              }

              // Infer tools/vision from name patterns when not in static list
              if (tools === undefined) {
                tools = !m.id.toLowerCase().includes('zephyr');
                vision = /vision|pixtral|llava|vl/i.test(m.id);
              }

              return {
                id: m.id,
                label: m.name || m.id,
                free: isFree,
                context: m.context_length ? `${Math.round(m.context_length / 1000)}k` : m.id.includes('llama-3') ? '128k' : '?',
                tools,
                vision,
              };
            });

          const result = formatted.length > 0 ? formatted : STATIC_MODELS[p];

          // Sort free models to the top
          result.sort((a, b) => {
            if (a.free !== b.free) return a.free ? -1 : 1;
            if ((a.vision || false) !== (b.vision || false)) return a.vision ? -1 : 1;
            return 0;
          });

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
