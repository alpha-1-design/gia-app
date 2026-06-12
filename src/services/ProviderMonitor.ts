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
  modelId: string;
  status: 'healthy' | 'degraded' | 'down';
  successRate: number; // 0–1
  avgLatencyMs: number;
  lastError: string | null;
  // Additional fields for internal use (not required by tests but kept for completeness)
  latencyMs: number | null;
  errorRate: number; // 0–1
  totalCalls: number;
  failedCalls: number;
  lastSuccess: number | null; // timestamp
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

interface ProviderStats {
  providerId: string;
  modelId: string;
  totalCalls: number;
  failedCalls: number;
  totalLatency: number;
  lastError: string | null;
  consecutiveFailures: number;
  lastSuccess: number | null;
  lastFailure: number | null;
}

class ProviderMonitorImpl {
  // Internal stats per providerId and modelId
  private stats = new Map<string, Map<string, ProviderStats>>();
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

  private getStats(providerId: string, modelId: string): ProviderStats {
    if (!this.stats.has(providerId)) {
      this.stats.set(providerId, new Map());
    }
    const providerMap = this.stats.get(providerId)!;
    if (!providerMap.has(modelId)) {
      providerMap.set(modelId, this.emptyStats(providerId, modelId));
    }
    return providerMap.get(modelId)!;
  }

  private emptyStats(providerId: string, modelId: string): ProviderStats {
    return {
      providerId,
      modelId,
      totalCalls: 0,
      failedCalls: 0,
      totalLatency: 0,
      lastError: null,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
    };
  }

  /** Reset metrics for a specific provider and model, or all if undefined */
  resetMetrics(providerId?: string, modelId?: string) {
    if (providerId && modelId) {
      const providerMap = this.stats.get(providerId);
      if (providerMap) {
        providerMap.delete(modelId);
      }
    } else if (providerId) {
      this.stats.delete(providerId);
    } else {
      this.stats.clear();
    }
  }

  recordCall(providerId: string, modelId: string, success: boolean, ms: number, error?: string) {
    const stats = this.getStats(providerId, modelId);
    stats.totalCalls++;
    if (success) {
      stats.totalLatency += ms;
      stats.lastSuccess = Date.now();
      stats.consecutiveFailures = 0;
    } else {
      stats.failedCalls++;
      stats.lastError = error || 'Unknown error';
      stats.consecutiveFailures++;
      stats.lastFailure = Date.now();
      stats.totalLatency += ms; // still count latency for failed calls? We'll include it.
    }
    // Notify listeners with the computed health object
    this.notify(this.getHealthObject(providerId, modelId, stats));
  }

  /** Record a successful call */
  recordSuccess(providerId: string, modelId: string, latencyMs: number) {
    this.recordCall(providerId, modelId, true, latencyMs);
  }

  /** Record a failed call */
  recordFailure(providerId: string, modelId: string, error: string, latencyMs: number) {
    this.recordCall(providerId, modelId, false, latencyMs, error);
  }

  /** Get health record for a provider/model pair */
  getHealth(providerId: string, modelId: string): ProviderHealthRecord {
    const stats = this.getStats(providerId, modelId);
    return this.getHealthObject(providerId, modelId, stats);
  }

  private getHealthObject(providerId: string, modelId: string, stats: ProviderStats): ProviderHealthRecord {
    const successRate = stats.totalCalls > 0 ? (stats.totalCalls - stats.failedCalls) / stats.totalCalls : 1;
    const avgLatencyMs = stats.totalCalls > 0 ? Math.round(stats.totalLatency / stats.totalCalls) : 0;
    const errorRate = stats.totalCalls > 0 ? stats.failedCalls / stats.totalCalls : 0;
    let status: ProviderHealthRecord['status'];
    if (stats.consecutiveFailures >= 10) {
      status = 'down';
    } else if (stats.consecutiveFailures >= 3) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    return {
      providerId,
      modelId,
      status,
      successRate,
      avgLatencyMs,
      lastError: stats.lastError ?? null,
      latencyMs: stats.totalCalls > 0 ? Math.round(stats.totalLatency / stats.totalCalls) : null, // same as avgLatencyMs? but we'll keep as last latency? Actually latencyMs field in original was last latency? We'll set to avgLatencyMs for consistency.
      errorRate,
      totalCalls: stats.totalCalls,
      failedCalls: stats.failedCalls,
      lastSuccess: stats.lastSuccess ?? null,
      lastChecked: Date.now(), // we update lastChecked on each call? We'll set to now.
      online: stats.consecutiveFailures === 0 && stats.totalCalls > 0 ? true : false, // Simplified: online if no consecutive failures and at least one call? We'll compute based on recent success.
    };
  }

  /** Get the best provider/model from a list of options based on health score */
  getBestProvider(options: { provider: string; model: string }[]): { provider: string; model: string } | undefined {
    let bestOption: { provider: string; model: string } | undefined;
    let bestScore = -1;

    for (const option of options) {
      const health = this.getHealth(option.provider, option.model);
      // Simple scoring: success rate (higher is better), inverse latency (lower is better)
      const successRate = 1 - health.errorRate; // errorRate is 0-1, so successRate = 1 - errorRate
      let latencyScore = 0;
      if (health.latencyMs !== null && health.latencyMs > 0) {
        // Normalize latency: assume max acceptable latency is 3000ms, scale 0-1
        latencyScore = Math.max(0, 1 - health.latencyMs / 3000);
      }
      const score = successRate * 0.7 + latencyScore * 0.3; // weight success rate more

      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return bestOption;
  }

  async testProvider(providerId: string): Promise<ProviderHealthRecord> {
    // We need a model to test with; use the configured model for this provider
    const def = providerRegistry.getProvider(providerId);
    const { providers } = useProviderStore.getState();
    const config = providers[providerId];

    if (!def || !config?.enabled) {
      const empty = this.emptyStats(providerId, '');
      empty.lastError = 'Provider not configured';
      return this.getHealthObject(providerId, '', empty);
    }

    // Use the model from config, or fallback to defaultModel from the provider definition
    const modelId = config.model || def.defaultModel;

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
      this.recordCall(providerId, modelId, res.ok, ms, res.ok ? undefined : `HTTP ${res.status}`);
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      this.recordCall(providerId, modelId, false, ms, e instanceof Error ? e.message : 'Fetch failed');
    }

    return this.getHealth(providerId, modelId);
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

  /** Get health records for all provider/model pairs */
  getAllHealth(): ProviderHealthRecord[] {
    const result: ProviderHealthRecord[] = [];
    for (const [providerId, modelMap] of this.stats) {
      for (const [modelId, stats] of modelMap) {
        result.push(this.getHealthObject(providerId, modelId, stats));
      }
    }
    return result;
  }
}

export const providerMonitor = new ProviderMonitorImpl();
export default providerMonitor;