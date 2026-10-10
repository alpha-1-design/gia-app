import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freeTier } from '../FreeTierService';

const STORAGE_KEY = 'gia:free-tier:v1';

describe('FreeTierService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('governs only the keyless free providers', () => {
    expect(freeTier.isFreeTier('pollinations')).toBe(true);
    expect(freeTier.isFreeTier('openai')).toBe(false);
    expect(freeTier.remainingToday('openai')).toBeNull();
  });

  it('allows requests until the per-minute cap, then blocks with a retry hint', () => {
    for (let i = 0; i < 20; i++) {
      expect(freeTier.check('pollinations').allowed).toBe(true);
      freeTier.record('pollinations');
    }
    const decision = freeTier.check('pollinations');
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterMs).toBeGreaterThan(0);
  });

  it('reports the remaining daily budget', () => {
    expect(freeTier.remainingToday('pollinations')).toBe(500);
    freeTier.record('pollinations');
    expect(freeTier.remainingToday('pollinations')).toBe(499);
  });

  it('does not count requests against providers it does not govern', () => {
    freeTier.record('openai');
    expect(freeTier.remainingToday('pollinations')).toBe(500);
  });

  it('blocks while in a 429 cool-down and clears once it elapses', () => {
    freeTier.markRateLimited('pollinations');
    const blocked = freeTier.check('pollinations');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toMatch(/busy/i);

    vi.advanceTimersByTime(61_000);
    expect(freeTier.check('pollinations').allowed).toBe(true);
  });

  it('blocks once the daily cap is reached', () => {
    const hits = Array.from({ length: 500 }, (_, i) => Date.now() - (i + 1) * 60_000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hits: { pollinations: hits }, cooldownUntil: {} }));
    const decision = freeTier.check('pollinations');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/daily/i);
  });
});
