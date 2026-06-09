interface CacheEntry {
  response: string;
  model: string;
  provider: string;
  timestamp: number;
  ttl: number;
}

interface CacheKey {
  prompt: string;
  model: string;
  provider: string;
  systemPrompt?: string;
}

function hashKey(key: CacheKey): string {
  const str = JSON.stringify({ prompt: key.prompt.slice(0, 500), model: key.model, provider: key.provider, systemPrompt: key.systemPrompt?.slice(0, 200) });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cache:${Math.abs(hash).toString(36)}`;
}

class ResponseCache {
  private static instance: ResponseCache;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private _maxEntries = 200;
  private _defaultTTL = 30 * 60 * 1000;

  static getInstance() {
    if (!this.instance) this.instance = new ResponseCache();
    return this.instance;
  }

  get maxEntries() { return this._maxEntries; }
  set maxEntries(n: number) { this._maxEntries = n; }

  get defaultTTL() { return this._defaultTTL; }
  set defaultTTL(ms: number) { this._defaultTTL = ms; }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  get(key: CacheKey): string | null {
    const h = hashKey(key);
    const entry = this.memoryCache.get(h);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.memoryCache.delete(h);
      return null;
    }
    return entry.response;
  }

  set(key: CacheKey, response: string, ttl?: number): void {
    if (this.memoryCache.size >= this._maxEntries) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest) this.memoryCache.delete(oldest);
    }
    const h = hashKey(key);
    this.memoryCache.set(h, {
      response,
      model: key.model,
      provider: key.provider,
      timestamp: Date.now(),
      ttl: ttl ?? this._defaultTTL,
    });
  }

  invalidate(provider?: string, model?: string): void {
    if (!provider && !model) {
      this.memoryCache.clear();
      return;
    }
    for (const [h, entry] of this.memoryCache) {
      if (provider && entry.provider === provider) this.memoryCache.delete(h);
      else if (model && entry.model === model) this.memoryCache.delete(h);
    }
  }

  size(): number {
    return this.memoryCache.size;
  }

  stats(): { size: number; oldest: number | null; newest: number | null } {
    let oldest: number | null = null;
    let newest: number | null = null;
    for (const entry of this.memoryCache.values()) {
      if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
      if (newest === null || entry.timestamp > newest) newest = entry.timestamp;
    }
    return { size: this.memoryCache.size, oldest, newest };
  }
}

export default ResponseCache.getInstance();
