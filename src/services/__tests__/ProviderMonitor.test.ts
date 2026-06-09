import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProviderMonitor from '../ProviderMonitor';

const mockProviderState = {
  providers: {
    openai: { enabled: true, apiKey: 'sk-test', model: 'gpt-4o' },
    anthropic: { enabled: true, apiKey: 'sk-ant', model: 'claude-3' },
  },
};

vi.mock('../../store/useProviderStore', () => ({
  useProviderStore: {
    getState: vi.fn(() => mockProviderState),
  },
}));

describe('ProviderMonitor', () => {
  beforeEach(() => {
    ProviderMonitor.resetMetrics();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns healthy for providers with no calls', () => {
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.status).toBe('healthy');
    expect(health.successRate).toBe(1);
    expect(health.avgLatencyMs).toBe(0);
  });

  it('tracks successful calls', () => {
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 500);
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.successRate).toBe(1);
    expect(health.avgLatencyMs).toBe(500);
  });

  it('tracks failed calls', () => {
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'timeout', 1000);
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.successRate).toBe(0);
    expect(health.lastError).toBe('timeout');
  });

  it('marks provider degraded after 3 consecutive failures', () => {
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e1', 100);
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e2', 100);
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e3', 100);
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.status).toBe('degraded');
  });

  it('recovers from degraded after successful calls', () => {
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e1', 100);
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e2', 100);
    ProviderMonitor.recordFailure('openai', 'gpt-4o', 'e3', 100);
    vi.advanceTimersByTime(3 * 60 * 1000);
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 200);
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.status).toBe('healthy');
  });

  it('marks provider down after enough consecutive failures', () => {
    for (let i = 0; i < 10; i++) {
      ProviderMonitor.recordFailure('openai', 'gpt-4o', `e${i}`, 100);
    }
    // Advance past the degraded window so 'down' status is not overridden
    vi.advanceTimersByTime(6 * 60 * 1000);
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.status).toBe('down');
  });

  it('getBestProvider picks provider with best score', () => {
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 100);
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 200);
    ProviderMonitor.recordSuccess('anthropic', 'claude-3', 1000);
    const result = ProviderMonitor.getBestProvider([
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'anthropic', model: 'claude-3' },
    ]);
    expect(result).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('getBestProvider skips down providers', () => {
    for (let i = 0; i < 10; i++) {
      ProviderMonitor.recordFailure('openai', 'gpt-4o', 'down', 100);
    }
    vi.advanceTimersByTime(6 * 60 * 1000);
    const result = ProviderMonitor.getBestProvider([
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'anthropic', model: 'claude-3' },
    ]);
    expect(result).toEqual({ provider: 'anthropic', model: 'claude-3' });
  });

  it('resetMetrics clears all when no args', () => {
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 100);
    ProviderMonitor.resetMetrics();
    const health = ProviderMonitor.getHealth('openai', 'gpt-4o');
    expect(health.avgLatencyMs).toBe(0);
    expect(health.successRate).toBe(1);
  });

  it('resetMetrics clears by provider and model', () => {
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 100);
    ProviderMonitor.recordSuccess('anthropic', 'claude-3', 200);
    ProviderMonitor.resetMetrics('openai', 'gpt-4o');
    expect(ProviderMonitor.getHealth('openai', 'gpt-4o').avgLatencyMs).toBe(0);
    expect(ProviderMonitor.getHealth('anthropic', 'claude-3').avgLatencyMs).toBe(200);
  });

  it('getAllHealth returns all tracked providers', () => {
    ProviderMonitor.recordSuccess('openai', 'gpt-4o', 100);
    ProviderMonitor.recordSuccess('anthropic', 'claude-3', 200);
    const all = ProviderMonitor.getAllHealth();
    expect(all).toHaveLength(2);
  });
});
