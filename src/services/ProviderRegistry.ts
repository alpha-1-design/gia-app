import { logger } from '../utils/logger';
import { corsProxy } from './CorsProxy';

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsApiKey: boolean;
  listingType: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'huggingface' | 'local' | 'none';
  imageModel?: string;
  headers?: Record<string, string>;
  aliases?: string[];
}

interface StaticModelOption {
  id: string;
  label: string;
  free: boolean;
  context?: string;
  tools?: boolean;
  vision?: boolean;
}

const FALLBACK_PROVIDERS: ProviderDef[] = [
  // Primary / cloud providers
  { id: 'openai',       label: 'OpenAI',        baseUrl: 'https://api.openai.com/v1',                 defaultModel: 'gpt-4o-mini',      needsApiKey: true,  listingType: 'openai',     aliases: ['oai'] },
  { id: 'anthropic',    label: 'Anthropic',     baseUrl: 'https://api.anthropic.com/v1',               defaultModel: 'claude-sonnet-4-20250514', needsApiKey: true, listingType: 'anthropic', aliases: ['ant', 'claude'] },
  { id: 'gemini',       label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com',  defaultModel: 'gemini-2.5-flash', needsApiKey: true,  listingType: 'gemini',    aliases: ['gmi', 'google'] },
  { id: 'opencode',     label: 'OpenCode Zen',  baseUrl: 'https://opencode.ai/zen/v1',                 defaultModel: 'deepseek-chat',    needsApiKey: true,  listingType: 'openai',     aliases: ['oc', 'zen'] },
  { id: 'openrouter',   label: 'OpenRouter',    baseUrl: 'https://openrouter.ai/api/v1',               defaultModel: 'google/gemma-3-27b-it:free', needsApiKey: true, listingType: 'openai', aliases: ['or'] },
  { id: 'groq',         label: 'Groq',          baseUrl: 'https://api.groq.com/openai/v1',            defaultModel: 'llama3-70b-8192',  needsApiKey: true,  listingType: 'openai',     aliases: [] },
  { id: 'deepseek',     label: 'DeepSeek',      baseUrl: 'https://api.deepseek.com/v1',                defaultModel: 'deepseek-chat',    needsApiKey: true,  listingType: 'openai',     aliases: ['ds'] },
  { id: 'cerebras',     label: 'Cerebras',      baseUrl: 'https://api.cerebras.ai/v1',                defaultModel: 'llama3.1-8b',      needsApiKey: true,  listingType: 'openai',     aliases: [] },
  { id: 'mistral',      label: 'Mistral AI',    baseUrl: 'https://api.mistral.ai/v1',                  defaultModel: 'mistral-small-latest', needsApiKey: true, listingType: 'openai',   aliases: [] },
  { id: 'xai',          label: 'xAI (Grok)',    baseUrl: 'https://api.x.ai/v1',                        defaultModel: 'grok-2',           needsApiKey: true,  listingType: 'openai',     aliases: ['grok'] },
  { id: 'togetherai',   label: 'Together AI',   baseUrl: 'https://api.together.xyz/v1',                defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', needsApiKey: true, listingType: 'openai', aliases: ['together'] },
  { id: 'huggingface',  label: 'HuggingFace',   baseUrl: 'https://api-inference.huggingface.co/v1',   defaultModel: 'Qwen/Qwen2.5-72B-Instruct', needsApiKey: true, listingType: 'huggingface', aliases: ['hf'] },
  { id: 'perplexity',   label: 'Perplexity',    baseUrl: 'https://api.perplexity.ai',                  defaultModel: 'sonar-pro',        needsApiKey: true,  listingType: 'openai',     aliases: ['pplx'] },
  { id: 'cohere',       label: 'Cohere',        baseUrl: 'https://api.cohere.ai/v1',                   defaultModel: 'command-r-plus',   needsApiKey: true,  listingType: 'openai',     aliases: [] },
  { id: 'fireworks',    label: 'Fireworks AI',  baseUrl: 'https://api.fireworks.ai/inference/v1',      defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct', needsApiKey: true, listingType: 'openai', aliases: [] },
  { id: 'deepinfra',    label: 'DeepInfra',     baseUrl: 'https://api.deepinfra.com/v1/openai',        defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct', needsApiKey: true, listingType: 'openai', aliases: [] },
  { id: 'ai21',         label: 'AI21 Labs',     baseUrl: 'https://api.ai21.com/studio/v1',             defaultModel: 'jamba-1.5-mini',   needsApiKey: true,  listingType: 'openai',     aliases: [] },
  { id: 'replicate',    label: 'Replicate',     baseUrl: 'https://api.replicate.com/v1',               defaultModel: 'meta/meta-llama-3-70b-instruct', needsApiKey: true, listingType: 'openai', aliases: ['rep'] },
  { id: 'nvidia',       label: 'NVIDIA NIM',    baseUrl: 'https://integrate.api.nvidia.com/v1',          defaultModel: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', needsApiKey: true, listingType: 'openai', aliases: ['niv'] },
  // Local providers
  { id: 'ollama',       label: 'Ollama (Local)',       baseUrl: 'http://localhost:11434/v1',             defaultModel: 'llama3.2',         needsApiKey: false, listingType: 'ollama',     aliases: ['ol'] },
  { id: 'lmstudio',     label: 'LM Studio (Local)',    baseUrl: 'http://localhost:1234/v1',              defaultModel: 'local-model',      needsApiKey: false, listingType: 'openai',     aliases: ['lms'] },
  { id: 'local-llm',    label: 'Local LLM (On-Device)', baseUrl: '',                                    defaultModel: 'Xenova/Qwen2.5-1.5B-Instruct', needsApiKey: false, listingType: 'local', aliases: ['local', 'ondevice'] },
];

const FALLBACK_MODELS: Record<string, StaticModelOption[]> = {
  opencode: [
    { id: 'deepseek-v4-flash-free',    label: 'DeepSeek V4 Flash',   free: true,  context: '64k',  tools: true, vision: true  },
    { id: 'gpt-4o-mini',               label: 'GPT-4o Mini',         free: false, context: '128k', tools: true, vision: true  },
  ],
  openrouter: [
    { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B',       free: true,  context: '96k',  tools: true, vision: true  },
    { id: 'openai/gpt-4o-mini',         label: 'GPT-4o Mini',        free: false, context: '128k', tools: true, vision: true  },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  free: false, context: '128k', tools: true, vision: true  },
    { id: 'gpt-4o',       label: 'GPT-4o',        free: false, context: '128k', tools: true, vision: true  },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4',   free: false, context: '200k', tools: true, vision: true },
    { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5',  free: false, context: '200k', tools: true, vision: true },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', free: true, context: '1M', tools: true, vision: true },
    { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   free: false, context: '1M', tools: true, vision: true },
  ],
  groq: [
    { id: 'llama3-70b-8192',      label: 'Llama 3 70B',       free: true, context: '8k',  tools: true, vision: false },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B',  free: true, context: '128k', tools: true, vision: false },
    { id: 'mixtral-8x7b-32768',   label: 'Mixtral 8x7B',      free: true, context: '32k', tools: false, vision: false },
    { id: 'gemma2-9b-it',         label: 'Gemma 2 9B',        free: true, context: '8k',  tools: true, vision: false },
  ],
  deepseek: [
    { id: 'deepseek-chat',        label: 'DeepSeek V3',       free: false, context: '64k', tools: true, vision: true  },
    { id: 'deepseek-reasoner',    label: 'DeepSeek R1',       free: false, context: '64k', tools: false, vision: false },
  ],
  cerebras: [
    { id: 'llama3.1-8b',     label: 'Llama 3.1 8B',      free: true, context: '8k',  tools: true, vision: false },
    { id: 'llama-3.3-70b',   label: 'Llama 3.3 70B',     free: true, context: '8k',  tools: true, vision: false },
  ],
  mistral: [
    { id: 'mistral-small-latest', label: 'Mistral Small',  free: true, context: '32k', tools: true, vision: true },
    { id: 'mistral-large-latest', label: 'Mistral Large',  free: false, context: '128k', tools: true, vision: true },
    { id: 'pixtral-large-latest', label: 'Pixtral Large',  free: false, context: '128k', tools: true, vision: true },
  ],
  xai: [
    { id: 'grok-2',   label: 'Grok 2',   free: false, context: '128k', tools: true, vision: false },
    { id: 'grok-vision-beta', label: 'Grok Vision', free: false, context: '8k', tools: false, vision: true },
  ],
  togetherai: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B', free: false, context: '128k', tools: true, vision: false },
    { id: 'deepseek-ai/DeepSeek-V3',                 label: 'DeepSeek V3',    free: false, context: '128k', tools: true, vision: false },
  ],
  huggingface: [
    { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B', free: false, context: '128k', tools: true, vision: false },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B', free: true, context: '32k', tools: false, vision: false },
  ],
  perplexity: [
    { id: 'sonar-pro',      label: 'Sonar Pro',      free: false, context: '200k', tools: false, vision: false },
    { id: 'sonar-deep-research', label: 'Sonar Deep', free: false, context: '200k', tools: false, vision: false },
  ],
  cohere: [
    { id: 'command-r-plus', label: 'Command R+', free: false, context: '128k', tools: true, vision: false },
    { id: 'command-r',      label: 'Command R',   free: false, context: '128k', tools: true, vision: false },
  ],
  fireworks: [
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B', free: false, context: '128k', tools: true, vision: false },
  ],
  deepinfra: [
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B', free: false, context: '128k', tools: true, vision: false },
  ],
  ai21: [
    { id: 'jamba-1.5-mini', label: 'Jamba 1.5 Mini', free: false, context: '256k', tools: false, vision: false },
    { id: 'jamba-1.5-large', label: 'Jamba 1.5 Large', free: false, context: '256k', tools: false, vision: false },
  ],
  replicate: [
    { id: 'meta/meta-llama-3-70b-instruct', label: 'Llama 3 70B', free: false, context: '8k', tools: false, vision: false },
  ],
  nvidia: [
    { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Nemotron Ultra 253B', free: false, context: '128k', tools: true, vision: false },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1',  label: 'Nemotron Super 49B',  free: false, context: '128k', tools: true, vision: true  },
    { id: 'meta/llama-3.3-70b-instruct',              label: 'Llama 3.3 70B',       free: true,  context: '128k', tools: true, vision: true  },
    { id: 'meta/llama-3.1-405b-instruct',             label: 'Llama 3.1 405B',      free: false, context: '128k', tools: true, vision: true  },
    { id: 'mistralai/mistral-large-24-11-07',         label: 'Mistral Large',       free: false, context: '128k', tools: true, vision: true  },
    { id: 'deepseek-ai/deepseek-r1',                  label: 'DeepSeek R1',         free: false, context: '128k', tools: false, vision: false },
  ],
  ollama: [
    { id: 'llama3.2',   label: 'Llama 3.2',   free: true, context: '128k', tools: true, vision: false },
    { id: 'gemma3',     label: 'Gemma 3',     free: true, context: '128k', tools: true, vision: true  },
    { id: 'phi4',       label: 'Phi-4',       free: true, context: '16k',  tools: true, vision: false },
  ],
  lmstudio: [
    { id: 'local-model', label: 'Loaded Model', free: true, context: '?', tools: true, vision: false },
  ],
  'local-llm': [
    { id: 'Xenova/Qwen2.5-0.5B-Instruct',  label: 'Qwen2.5 0.5B (Lightning)', free: true, context: '32k',  tools: true, vision: false },
    { id: 'Xenova/Qwen2.5-1.5B-Instruct',  label: 'Qwen2.5 1.5B (Balanced)',  free: true, context: '32k',  tools: true, vision: false },
    { id: 'Xenova/Qwen2.5-3B-Instruct',    label: 'Qwen2.5 3B (Ultra)',       free: true, context: '32k',  tools: true, vision: false },
  ],
};

// Known image generation models
const FALLBACK_IMAGE_MODELS: Record<string, string> = {
  openai: 'dall-e-3',
  openrouter: 'openai/dall-e-3',
  nvidia: 'nvidia/sana-4k',
};

class ProviderRegistry {
  private providers: Map<string, ProviderDef> = new Map();
  private models: Map<string, StaticModelOption[]> = new Map();
  private imageModels: Map<string, string> = new Map();
  private loaded = false;
  private loading: Promise<void> | null = null;

  async init(): Promise<void> {
    // Start with fallback
    for (const def of FALLBACK_PROVIDERS) {
      this.providers.set(def.id, def);
    }
    for (const [id, models] of Object.entries(FALLBACK_MODELS)) {
      this.models.set(id, models);
    }
    for (const [id, model] of Object.entries(FALLBACK_IMAGE_MODELS)) {
      this.imageModels.set(id, model);
    }

    // Try remote config — enrich (not replace) fallback
    this.loading = this.fetchRemote();
    try {
      await this.loading;
    } catch { /* remote config unavailable, fallback only */ }
    this.loaded = true;
    this.loading = null;
  }

  private async fetchRemote(): Promise<void> {
    const configUrl = 'https://opencode.ai/api/providers';
    try {
      const res = await corsProxy.fetch(configUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data: {
        providers?: ProviderDef[];
        models?: Record<string, StaticModelOption[]>;
        imageModels?: Record<string, string>;
      } = await res.json();

      if (data.providers) {
        for (const def of data.providers) {
          this.providers.set(def.id, def);
        }
      }
      if (data.models) {
        for (const [id, modelList] of Object.entries(data.models)) {
          this.models.set(id, modelList);
        }
      }
      if (data.imageModels) {
        for (const [id, model] of Object.entries(data.imageModels)) {
          this.imageModels.set(id, model);
        }
      }
    } catch (e) {
      logger.warn('[ProviderRegistry] Remote config fetch failed, using fallback:', e);
    }
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded && this.loading) {
      await this.loading;
    }
    if (!this.loaded) {
      await this.init();
    }
  }

  getProvider(id: string): ProviderDef | undefined {
    return this.providers.get(id);
  }

  getLabel(id: string): string {
    return this.providers.get(id)?.label ?? id;
  }

  getBaseUrl(id: string): string {
    return this.providers.get(id)?.baseUrl ?? '';
  }

  getDefaultModel(id: string): string {
    return this.providers.get(id)?.defaultModel ?? '';
  }

  getListingType(id: string): ProviderDef['listingType'] {
    return this.providers.get(id)?.listingType ?? 'openai';
  }

  getImageModel(id: string): string | undefined {
    return this.imageModels.get(id);
  }

  getAllIds(): string[] {
    return Array.from(this.providers.keys());
  }

  getAllProviders(): ProviderDef[] {
    return Array.from(this.providers.values());
  }

  getModels(id: string): StaticModelOption[] {
    return this.models.get(id) ?? [];
  }

  getNeedsApiKey(id: string): boolean {
    return this.providers.get(id)?.needsApiKey ?? true;
  }

  /** Resolve an id or alias to a full provider id, or return the input unchanged if not found. */
  resolveAlias(s: string): string {
    // Direct match
    if (this.providers.has(s)) return s;
    // Alias lookup
    for (const [id, def] of this.providers) {
      if (def.aliases?.includes(s)) return id;
    }
    return s; // return as-is
  }
}

export const providerRegistry = new ProviderRegistry();
