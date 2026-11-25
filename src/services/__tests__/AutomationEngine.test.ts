/**
 * AutomationEngine scheduling tests.
 *
 * The engine used to tick every 30s regardless of rules; it now sleeps
 * until the next time/cron rule can actually fire (capped at 15 min) and
 * schedules nothing when there are no such rules, restarting from the
 * store subscription when rules change.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal in-memory automation store backing the engine under test.
type Rule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: { type: string; params: Record<string, string>; cooldownMs: number };
  actions: Array<{ type: string; params: Record<string, string> }>;
  created: number;
  lastTriggered: number | null;
  triggerCount: number;
  maxTriggersPerDay: number;
};

let storeRules: Rule[] = [];
const storeListeners = new Set<() => void>();
const notifyStoreChanged = () => storeListeners.forEach((cb) => cb());

vi.mock('../../store/useAutomationStore', () => ({
  useAutomationStore: {
    getState: () => ({
      rules: storeRules,
      getEnabledRules: () => storeRules.filter((r) => r.enabled),
      recordTrigger: (id: string) => {
        const rule = storeRules.find((r) => r.id === id);
        if (rule) {
          rule.lastTriggered = Date.now();
          rule.triggerCount += 1;
        }
      },
    }),
    subscribe: vi.fn((cb: () => void) => {
      storeListeners.add(cb);
      return () => storeListeners.delete(cb);
    }),
  },
}));

vi.mock('../../store/useMemoryStore', () => ({
  useMemoryStore: {
    getState: () => ({ addMemory: vi.fn() }),
  },
}));

// Dynamic import so the mock factories see the initialized store state.
const { AutomationEngine } = await import('../AutomationEngine');

// 2026-06-01 10:00:00 local time.
const BASE = new Date(2026, 5, 1, 10, 0, 0, 0).getTime();

function makeRule(overrides: Partial<Rule> & { trigger: Rule['trigger'] }): Rule {
  return {
    id: 'rule-1',
    name: 'Test rule',
    description: '',
    enabled: true,
    actions: [{ type: 'mark', params: {} }],
    created: BASE,
    lastTriggered: null,
    triggerCount: 0,
    maxTriggersPerDay: 0,
    ...overrides,
  };
}

describe('AutomationEngine scheduling', () => {
  let handler: (params: Record<string, string>) => Promise<void>;
  let handlerCalls = 0;
  let engine: InstanceType<typeof AutomationEngine>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    storeRules = [];
    storeListeners.clear();
    handlerCalls = 0;
    handler = vi.fn(async (_params: Record<string, string>) => {
      handlerCalls += 1;
    });
    engine = new AutomationEngine();
    engine.registerAction('mark', handler);
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it('schedules nothing when there are no rules', () => {
    engine.start();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules nothing for event-only rules (no timer, no wakes)', () => {
    storeRules = [makeRule({ trigger: { type: 'notification', params: {}, cooldownMs: 0 } })];
    engine.start();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts scheduling from the store subscription when a rule is added', () => {
    engine.start();
    expect(vi.getTimerCount()).toBe(0);

    storeRules = [makeRule({ trigger: { type: 'time', params: { time: '10:02' }, cooldownMs: 0 } })];
    notifyStoreChanged();

    expect(vi.getTimerCount()).toBe(1);
  });

  it('fires a time rule inside its target minute and reschedules', async () => {
    storeRules = [makeRule({ trigger: { type: 'time', params: { time: '10:02' }, cooldownMs: 0 } })];
    engine.start();
    expect(handler).not.toHaveBeenCalled();

    // Not due yet: 1s before the lead-in lands inside the minute.
    await vi.advanceTimersByTimeAsync(119_000);
    expect(handler).not.toHaveBeenCalled();

    // Crosses 10:02:01 — the tick runs and triggers the rule.
    await vi.advanceTimersByTimeAsync(2_500);
    expect(handler).toHaveBeenCalledTimes(1);

    // Self-rescheduled (next due is tomorrow, so capped at 15 min).
    expect(vi.getTimerCount()).toBe(1);

    // No repeat trigger from the follow-up ticks.
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('caps the sleep at 15 minutes and still fires a far-future rule', async () => {
    storeRules = [makeRule({ trigger: { type: 'time', params: { time: '23:00' }, cooldownMs: 0 } })];
    engine.start();

    // 13h out — must only be reachable through ≤15 min self-reschedules.
    let triggered = false;
    for (let i = 0; i < 53 && !triggered; i++) {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
      triggered = handlerCalls > 0;
    }
    expect(triggered).toBe(true);
    expect(handlerCalls).toBe(1);
  });

  it('fires a cron rule at its next matching minute', async () => {
    // 10:00 now → next "30 14 * * *" match is today 14:30:01.
    storeRules = [makeRule({ trigger: { type: 'cron', params: { expr: '30 14 * * *' }, cooldownMs: 0 } })];
    engine.start();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000); // 10:00 → 14:00
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(31 * 60_000); // 14:00 → 14:31
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling when the last rule is removed', () => {
    storeRules = [makeRule({ trigger: { type: 'time', params: { time: '10:02' }, cooldownMs: 0 } })];
    engine.start();
    expect(vi.getTimerCount()).toBe(1);

    storeRules = [];
    notifyStoreChanged();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() clears the pending schedule', () => {
    storeRules = [makeRule({ trigger: { type: 'time', params: { time: '10:02' }, cooldownMs: 0 } })];
    engine.start();
    expect(vi.getTimerCount()).toBe(1);

    engine.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(engine.getStatus()).toContain('stopped');
  });
});
