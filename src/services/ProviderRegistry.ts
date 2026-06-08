import { logger } from '../utils/logger';
import { corsProxy } from './CorsProxy';

export interface ProviderDef {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsApiKey: boolean;
  listingType: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'huggingface' | 'none';
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
  { id: 'opencode',   label: 'OpenCode',   baseUrl: 'https://opencode.ai/zen/v1',           defaultModel: 'deepseek-chat',   needsApiKey: true,  listingType: 'openai', aliases: ['oc'] },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1',          defaultModel: 'google/gemma-3-27b-it:free', needsApiKey: true, listingType: 'openai', aliases: ['or'] },
  { id: 'ollama',     label: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1',         defaultModel: 'llama3.2',        needsApiKey: false, listingType: 'ollama', aliases: ['ol'] },
  { id: 'lmstudio',   label: 'LM Studio (Local)', baseUrl: 'http://localhost:1234/v1',       defaultModel: 'local-model',     needsApiKey: false, listingType: 'openai', aliases: ['lms'] },
  { id: 'openai',     label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1',             defaultModel: 'gpt-4o-mini',     needsApiKey: true,  listingType: 'openai', aliases: ['oai'] },
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
  ollama: [
    { id: 'llama3.2',   label: 'Llama 3.2',   free: true, context: '128k', tools: true, vision: false },
    { id: 'gemma3',     label: 'Gemma 3',     free: true, context: '128k', tools: true, vision: true  },
    { id: 'phi4',       label: 'Phi-4',       free: true, context: '16k',  tools: true, vision: false },
  ],
  lmstudio: [
    { id: 'local-model', label: 'Loaded Model', free: true, context: '?', tools: true, vision: false },
  ],
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  free: false, context: '128k', tools: true, vision: true  },
    { id: 'gpt-4o',       label: 'GPT-4o',        free: false, context: '128k', tools: true, vision: true  },
  ],
};

// Known image generation models
const FALLBACK_IMAGE_MODELS: Record<string, string> = {
  openai: 'dall-e-3',
  openrouter: 'openai/dall-e-3',
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
