/**
 * ProviderMonitor — tracks latency, error rate, and health per provider.
 * Phase 0.3: Foundation for Engine Room health dashboard.
 */
import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from './ProviderRegistry';
import { corsProxy } from './CorsProxy';

export interface ProviderHealthRecord {
  providerId: string;
  latencyMs: number | null;
  errorRate: number;          // 0–1
  totalCalls: number;
  failedCalls: number;
  lastSuccess: number | null; // timestamp
  lastError: string | null;
  lastChecked: number;
  online: boolean;
}

export interface NetworkState {
  online: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'none';
  metered: boolean;
  latencyMs: number | null;
  lastChange: number;
}

type HealthCallback = (record: ProviderHealthRecord) => void;

class ProviderMonitorImpl {
  private records = new Map<string, ProviderHealthRecord>();
  private listeners = new Set<HealthCallback>();
  private network: NetworkState = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: 'none',
    metered: false,
    latencyMs: null,
    lastChange: Date.now(),
  };
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Track online status from browser
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateNetwork({ online: true, lastChange: Date.now() }));
      window.addEventListener('offline', () => this.updateNetwork({ online: false, lastChange: Date.now() }));
    }
  }

  // ── Network ─────────────────────────────────────────────────────

  getNetwork(): NetworkState {
    return { ...this.network };
  }

  private updateNetwork(partial: Partial<NetworkState>) {
    this.network = { ...this.network, ...partial };
    logger.info('[ProviderMonitor] Network changed:', this.network);
  }

  async pingNetwork(): Promise<number> {
    const start = performance.now();
    try {
      await corsProxy.fetch('https://httpbin.org/get', {
        signal: AbortSignal.timeout(5000),
      });
      const ms = Math.round(performance.now() - start);
      this.updateNetwork({ online: true, latencyMs: ms, lastChange: Date.now() });
      return ms;
    } catch {
      this.updateNetwork({ online: false, latencyMs: null, lastChange: Date.now() });
      throw new Error('Network unreachable');
    }
  }

  // ── Provider Health ──────────────────────────────────────────────

  getRecord(providerId: string): ProviderHealthRecord {
    if (!this.records.has(providerId)) {
      this.records.set(providerId, this.emptyRecord(providerId));
    }
    return this.records.get(providerId)!;
  }

  getAllRecords(): ProviderHealthRecord[] {
    const ids = providerRegistry.getAllIds();
    return ids.map(id => this.getRecord(id));
  }

  private emptyRecord(providerId: string): ProviderHealthRecord {
    return {
      providerId,
      latencyMs: null,
      errorRate: 0,
      totalCalls: 0,
      failedCalls: 0,
      lastSuccess: null,
      lastError: null,
      lastChecked: Date.now(),
      online: false,
    };
  }

  recordCall(providerId: string, success: boolean, ms: number, error?: string) {
    const record = this.getRecord(providerId);
    record.totalCalls++;
    record.lastChecked = Date.now();
    if (success) {
      record.latencyMs = ms;
      record.lastSuccess = Date.now();
      record.online = true;
    } else {
      record.failedCalls++;
      record.lastError = error || 'Unknown error';
      record.errorRate = record.failedCalls / record.totalCalls;
    }
    this.records.set(providerId, record);
    this.notify(record);
  }

  async testProvider(providerId: string): Promise<ProviderHealthRecord> {
    const record = this.getRecord(providerId);
    const def = providerRegistry.getProvider(providerId);
    const { providers } = useProviderStore.getState();
    const config = providers[providerId];

    if (!def || !config?.enabled) {
      record.online = false;
      record.lastError = 'Provider not configured';
      return record;
    }

    const start = performance.now();
    try {
      // Ping the provider's /models endpoint as a health check
      const baseUrl = config?.baseUrl || def.baseUrl;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

      const res = await corsProxy.fetch(`${baseUrl}/models`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });

      const ms = Math.round(performance.now() - start);
      this.recordCall(providerId, res.ok, ms, res.ok ? undefined : `HTTP ${res.status}`);
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      this.recordCall(providerId, false, ms, e instanceof Error ? e.message : 'Fetch failed');
    }

    return this.getRecord(providerId);
  }

  async testAllProviders(): Promise<ProviderHealthRecord[]> {
    const providers = useProviderStore.getState().providers;
    const results: ProviderHealthRecord[] = [];
    for (const [id, cfg] of Object.entries(providers)) {
      if (cfg.enabled) {
        results.push(await this.testProvider(id));
      }
    }
    return results;
  }

  // ── Listeners ───────────────────────────────────────────────────

  subscribe(cb: HealthCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(record: ProviderHealthRecord) {
    this.listeners.forEach(cb => {
      try { cb(record); } catch { /* ignore listener errors */ }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  startAutoPing(intervalMs = 60000) {
    this.stopAutoPing();
    this.pingInterval = setInterval(() => {
      this.pingNetwork().catch(() => {});
    }, intervalMs);
  }

  stopAutoPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const providerMonitor = new ProviderMonitorImpl();
