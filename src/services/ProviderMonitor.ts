import { logger } from '../utils/logger';
import { useProviderStore } from '../store/useProviderStore';

interface ProviderMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalLatencyMs: number;
  lastLatencyMs: number;
  lastError: string | null;
  lastCallAt: number | null;
  consecutiveFailures: number;
  isDegraded: boolean;
  degradedAt: number | null;
}

interface ProviderHealth {
  provider: string;
  model: string;
  status: 'healthy' | 'degraded' | 'down';
  avgLatencyMs: number;
  successRate: number;
  lastError: string | null;
}

const DEGRADE_THRESHOLD = 3;
const DEGRADE_WINDOW_MS = 5 * 60 * 1000;
const RECOVERY_THRESHOLD_MS = 2 * 60 * 1000;

class ProviderMonitor {
  private static instance: ProviderMonitor;
  private metrics: Map<string, ProviderMetrics> = new Map();

  static getInstance() {
    if (!this.instance) this.instance = new ProviderMonitor();
    return this.instance;
  }

  private key(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  private getOrCreate(provider: string, model: string): ProviderMetrics {
    const k = this.key(provider, model);
    if (!this.metrics.has(k)) {
      this.metrics.set(k, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalLatencyMs: 0,
        lastLatencyMs: 0,
        lastError: null,
        lastCallAt: null,
        consecutiveFailures: 0,
        isDegraded: false,
        degradedAt: null,
      });
    }
    return this.metrics.get(k)!;
  }

  recordSuccess(provider: string, model: string, latencyMs: number): void {
    const m = this.getOrCreate(provider, model);
    m.totalCalls++;
    m.successfulCalls++;
    m.totalLatencyMs += latencyMs;
    m.lastLatencyMs = latencyMs;
    m.lastCallAt = Date.now();
    m.consecutiveFailures = 0;
    if (m.isDegraded && m.degradedAt && Date.now() - m.degradedAt > RECOVERY_THRESHOLD_MS) {
      m.isDegraded = false;
      m.degradedAt = null;
      logger.log(`[ProviderMonitor] ${provider}/${model} recovered from degraded state`);
    }
  }

  recordFailure(provider: string, model: string, error: string, latencyMs: number): void {
    const m = this.getOrCreate(provider, model);
    m.totalCalls++;
    m.failedCalls++;
    m.totalLatencyMs += latencyMs;
    m.lastLatencyMs = latencyMs;
    m.lastError = error;
    m.lastCallAt = Date.now();
    m.consecutiveFailures++;
    if (m.consecutiveFailures >= DEGRADE_THRESHOLD && !m.isDegraded) {
      m.isDegraded = true;
      m.degradedAt = Date.now();
      logger.warn(`[ProviderMonitor] ${provider}/${model} marked degraded (${m.consecutiveFailures} consecutive failures)`);
    }
  }

  getHealth(provider: string, model: string): ProviderHealth {
    const m = this.getOrCreate(provider, model);
    const successRate = m.totalCalls > 0 ? m.successfulCalls / m.totalCalls : 1;
    const avgLatency = m.totalCalls > 0 ? Math.round(m.totalLatencyMs / m.totalCalls) : 0;
    let status: ProviderHealth['status'] = 'healthy';
    if (m.isDegraded) status = 'degraded';
    if (m.consecutiveFailures >= 10) status = 'down';
    if (m.totalCalls === 0) status = 'healthy';
    const degradedRecently = m.degradedAt && Date.now() - m.degradedAt < DEGRADE_WINDOW_MS;
    if (degradedRecently && m.isDegraded) status = 'degraded';

    return { provider, model, status, avgLatencyMs: avgLatency, successRate, lastError: m.lastError };
  }

  getBestProvider(models: { provider: string; model: string }[]): { provider: string; model: string } | null {
    let best: { provider: string; model: string } | null = null;
    let bestScore = -Infinity;

    for (const { provider, model } of models) {
      const health = this.getHealth(provider, model);
      const { providers } = useProviderStore.getState();
      const cfg = providers[provider];
      if (!cfg?.enabled || !cfg?.apiKey) continue;
      if (health.status === 'down') continue;
      const score = health.successRate * 100 - health.avgLatencyMs / 10;
      if (score > bestScore) {
        bestScore = score;
        best = { provider, model };
      }
    }
    return best;
  }

  resetMetrics(provider?: string, model?: string): void {
    if (provider && model) {
      this.metrics.delete(this.key(provider, model));
    } else if (provider) {
      for (const [k] of this.metrics) {
        if (k.startsWith(`${provider}:`)) this.metrics.delete(k);
      }
    } else {
      this.metrics.clear();
    }
  }

  getAllHealth(): ProviderHealth[] {
    const result: ProviderHealth[] = [];
    for (const [k] of this.metrics) {
      const [provider, ...modelParts] = k.split(':');
      result.push(this.getHealth(provider, modelParts.join(':')));
    }
    return result;
  }
}

export default ProviderMonitor.getInstance();
