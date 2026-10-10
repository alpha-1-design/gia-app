import { logger } from '../utils/logger';
import { idbStorage } from '../store/idb-storage';

export const MODELS_DEV_URL = 'https://models.opencode.ai/api.json';
const CACHE_KEY = 'gia.modelsdev.catalog.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * App provider id -> models.dev provider id. Only providers we actually surface
 * are mapped; `replicate` has no models.dev entry, and the local providers
 * (`ollama`, `lmstudio`, `local-llm`) keep their own catalogs / live listing.
 */
export const MODELS_DEV_PROVIDER_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'google',
  opencode: 'opencode',
  openrouter: 'openrouter',
  groq: 'groq',
  deepseek: 'deepseek',
  cerebras: 'cerebras',
  mistral: 'mistral',
  xai: 'xai',
  togetherai: 'togetherai',
  huggingface: 'huggingface',
  perplexity: 'perplexity',
  cohere: 'cohere',
  fireworks: 'fireworks-ai',
  deepinfra: 'deepinfra',
  ai21: 'ai21',
  nvidia: 'nvidia',
};

export interface ModelsDevModel {
  id: string;
  name: string;
  release_date?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
    [k: string]: number | undefined;
  };
}

export interface ModelsDevProvider {
  id: string;
  name: string;
  models: Record<string, ModelsDevModel>;
}

export type ModelsDevCatalog = Record<string, ModelsDevProvider>;

interface RawModel {
  id?: string;
  name?: string;
  release_date?: string;
  tool_call?: boolean;
  reasoning?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: ModelsDevModel['cost'];
  [k: string]: unknown;
}

interface RawProvider {
  id?: string;
  name?: string;
  models?: Record<string, RawModel>;
  [k: string]: unknown;
}

interface CacheEntry {
  fetchedAt: number;
  catalog: ModelsDevCatalog;
}

let inMemory: ModelsDevCatalog | null = null;

function trimModel(raw: RawModel): ModelsDevModel | null {
  if (!raw || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    release_date: typeof raw.release_date === 'string' ? raw.release_date : undefined,
    tool_call: typeof raw.tool_call === 'boolean' ? raw.tool_call : undefined,
    reasoning: typeof raw.reasoning === 'boolean' ? raw.reasoning : undefined,
    modalities: raw.modalities,
    limit: raw.limit,
    cost: raw.cost,
  };
}

/** Keep only mapped providers and the fields the app consumes — 5.3 MB → a few hundred KB. */
export function trimModelsDevCatalog(raw: Record<string, RawProvider>): ModelsDevCatalog {
  const wanted = new Set(Object.values(MODELS_DEV_PROVIDER_MAP));
  const catalog: ModelsDevCatalog = {};
  for (const [devId, prov] of Object.entries(raw)) {
    if (!wanted.has(devId) || !prov || typeof prov !== 'object' || !prov.models) continue;
    const models: Record<string, ModelsDevModel> = {};
    for (const [modelId, model] of Object.entries(prov.models)) {
      const trimmed = trimModel(model);
      if (trimmed) models[modelId] = trimmed;
    }
    if (Object.keys(models).length === 0) continue;
    catalog[devId] = {
      id: typeof prov.id === 'string' ? prov.id : devId,
      name: typeof prov.name === 'string' ? prov.name : devId,
      models,
    };
  }
  return catalog;
}

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await idbStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !parsed.catalog) return null;
    return parsed;
  } catch (e) {
    logger.warn('[ModelsDevCatalog] Failed to read cache:', e);
    return null;
  }
}

async function writeCache(catalog: ModelsDevCatalog): Promise<void> {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), catalog };
    await idbStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    logger.warn('[ModelsDevCatalog] Failed to write cache:', e);
  }
}

async function fetchCatalog(): Promise<ModelsDevCatalog> {
  const res = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`models.dev ${res.status}`);
  const raw = (await res.json()) as Record<string, RawProvider>;
  return trimModelsDevCatalog(raw);
}

/**
 * Returns the models.dev catalog (trimmed), using the 24h IndexedDB cache when
 * fresh. On network failure a stale cache is served if present, otherwise null
 * so callers fall back to the curated catalogs.
 */
export async function loadModelsDevCatalog(force = false): Promise<ModelsDevCatalog | null> {
  const cached = await readCache();
  if (!force && isFresh(cached)) {
    inMemory = cached.catalog;
    return inMemory;
  }
  try {
    const catalog = await fetchCatalog();
    await writeCache(catalog);
    inMemory = catalog;
    return catalog;
  } catch (e) {
    logger.warn('[ModelsDevCatalog] Live fetch failed, using cached catalog if any:', e);
    if (cached) {
      inMemory = cached.catalog;
      return inMemory;
    }
    return null;
  }
}

export function getModelsDevCatalogSync(): ModelsDevCatalog | null {
  return inMemory;
}