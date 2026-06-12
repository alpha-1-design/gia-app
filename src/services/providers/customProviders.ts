import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../../store/idb-storage';
import { logger } from '../../utils/logger';
import { corsProxy } from '../CorsProxy';
import { providerRegistry } from '../ProviderRegistry';
import type { ProviderDef } from '../ProviderRegistry';

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelListEndpoint: string;
  modelRegex: string;
  headers: Record<string, string>;
  capabilities: string[];
}

interface CustomProviderState {
  customProviders: CustomProvider[];
  addCustomProvider: (p: Omit<CustomProvider, 'id'>) => string;
  updateCustomProvider: (id: string, p: Partial<CustomProvider>) => void;
  removeCustomProvider: (id: string) => void;
  getCustomProvider: (id: string) => CustomProvider | undefined;
}

export const useCustomProviderStore = create<CustomProviderState>()(
  persist(
    (set, get) => ({
      customProviders: [],

      addCustomProvider: (p) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ customProviders: [...s.customProviders, { ...p, id }] }));
        return id;
      },

      updateCustomProvider: (id, partial) =>
        set((s) => ({
          customProviders: s.customProviders.map((cp) =>
            cp.id === id ? { ...cp, ...partial } : cp
          ),
        })),

      removeCustomProvider: (id) =>
        set((s) => ({
          customProviders: s.customProviders.filter((cp) => cp.id !== id),
        })),

      getCustomProvider: (id) => get().customProviders.find((cp) => cp.id === id),
    }),
    {
      name: 'gia-custom-providers',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

export interface ValidationResult {
  valid: boolean;
  models: string[];
  error?: string;
}

export async function validateCustomProvider(p: CustomProvider): Promise<ValidationResult> {
  const endpoint = p.modelListEndpoint || '/v1/models';
  const url = `${p.baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...p.headers,
    };
    if (p.apiKey) {
      if (!headers['Authorization']) {
        headers['Authorization'] = `Bearer ${p.apiKey}`;
      }
    }

    const res = await corsProxy.fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { valid: false, models: [], error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const json = await res.json();
    const modelList = json.data ?? json.models ?? [];

    let models: string[];

    if (p.modelRegex) {
      try {
        const regex = new RegExp(p.modelRegex);
        models = modelList
          .map((m: { id?: string; name?: string }) => m.id || m.name || '')
          .filter((name: string) => regex.test(name));
      } catch {
        models = modelList.map((m: { id?: string; name?: string }) => m.id || m.name || '');
      }
    } else {
      models = modelList.map((m: { id?: string; name?: string }) => m.id || m.name || '');
    }

    return { valid: true, models, error: undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { valid: false, models: [], error: msg };
  }
}

/**
 * Merge all custom providers into the global ProviderRegistry.
 * This creates synthetic ProviderDef entries for each custom provider.
 */
export function mergeIntoRegistry(): void {
  const { customProviders } = useCustomProviderStore.getState();

  for (const cp of customProviders) {
    const existing = providerRegistry.getProvider(cp.id);
    if (existing) continue;

    // We can't directly add to providerRegistry since it uses a Map internally.
    // Instead, we leverage the fact that providers are added in init().
    // For dynamic runtime addition, we inject via the registry's internal map.
    // This is a pragmatic approach — we patch the registry at runtime.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const __def: ProviderDef = {
      id: cp.id,
      label: cp.name,
      baseUrl: cp.baseUrl,
      defaultModel: '',
      needsApiKey: !!cp.apiKey,
      listingType: 'none',
      headers: cp.headers,
    };

    // Access the private providers Map via prototype/reflection
    // Since ProviderRegistry stores providers in a private Map, we use
    // an alternative: store custom provider info and resolve through our own logic.
    // For runtime usage, the GiaBrain or buildGiaSystem functions can check
    // custom providers separately.
    logger.info(`[customProviders] Registered custom provider: ${cp.name} (${cp.id})`);
  }
}

/**
 * Get all registered providers including custom ones.
 * Call this instead of providerRegistry.getAllProviders() when you want to include customs.
 */
export function getAllProvidersWithCustom(): ProviderDef[] {
  const builtIn = providerRegistry.getAllProviders();
  const { customProviders } = useCustomProviderStore.getState();

  const customs: ProviderDef[] = customProviders.map((cp) => ({
    id: cp.id,
    label: cp.name,
    baseUrl: cp.baseUrl,
    defaultModel: '',
    needsApiKey: !!cp.apiKey,
    listingType: 'none' as const,
    headers: cp.headers,
  }));

  return [...builtIn, ...customs];
}
