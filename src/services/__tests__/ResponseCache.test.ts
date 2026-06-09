import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResponseCache from '../ResponseCache';

describe('ResponseCache', () => {
  beforeEach(() => {
    ResponseCache.invalidate();
    ResponseCache.maxEntries = 200;
    ResponseCache.defaultTTL = 30 * 60 * 1000;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const key = { prompt: 'hello', model: 'gpt-4o', provider: 'openai' };
  const otherKey = { prompt: 'world', model: 'gpt-4o', provider: 'openai' };
  const diffModelKey = { prompt: 'hello', model: 'claude-3', provider: 'anthropic' };

  it('is a singleton', () => {
    expect(ResponseCache).toBeDefined();
    expect(ResponseCache.get).toBeInstanceOf(Function);
    expect(ResponseCache.set).toBeInstanceOf(Function);
  });

  it('returns null for cache miss', () => {
    expect(ResponseCache.get(key)).toBeNull();
  });

  it('returns cached response on hit', () => {
    ResponseCache.set(key, 'response text');
    expect(ResponseCache.get(key)).toBe('response text');
  });

  it('returns null after TTL expiry', () => {
    ResponseCache.set(key, 'expiring soon', 1000);
    vi.advanceTimersByTime(1001);
    expect(ResponseCache.get(key)).toBeNull();
  });

  it('returns cached value before TTL expiry', () => {
    ResponseCache.set(key, 'still valid', 5000);
    vi.advanceTimersByTime(4000);
    expect(ResponseCache.get(key)).toBe('still valid');
  });

  it('evicts oldest entry when at max capacity', () => {
    ResponseCache.maxEntries = 2;
    ResponseCache.set({ prompt: 'a', model: 'm', provider: 'p' }, 'first');
    ResponseCache.set({ prompt: 'b', model: 'm', provider: 'p' }, 'second');
    ResponseCache.set({ prompt: 'c', model: 'm', provider: 'p' }, 'third');
    expect(ResponseCache.size()).toBe(2);
    expect(ResponseCache.get({ prompt: 'a', model: 'm', provider: 'p' })).toBeNull();
  });

  it('invalidate clears all entries when no args', () => {
    ResponseCache.set(key, 'resp');
    ResponseCache.set(otherKey, 'resp2');
    expect(ResponseCache.size()).toBe(2);
    ResponseCache.invalidate();
    expect(ResponseCache.size()).toBe(0);
  });

  it('invalidate clears entries by provider', () => {
    ResponseCache.set(key, 'openai resp');
    ResponseCache.set(diffModelKey, 'anthropic resp');
    ResponseCache.invalidate('openai');
    expect(ResponseCache.get(key)).toBeNull();
    expect(ResponseCache.get(diffModelKey)).toBe('anthropic resp');
  });

  it('invalidate clears entries by model', () => {
    ResponseCache.set(key, 'gpt resp');
    ResponseCache.set(diffModelKey, 'claude resp');
    ResponseCache.invalidate(undefined, 'gpt-4o');
    expect(ResponseCache.get(key)).toBeNull();
    expect(ResponseCache.get(diffModelKey)).toBe('claude resp');
  });

  it('stats returns correct size and timestamps', () => {
    ResponseCache.set(key, 'resp');
    const stats = ResponseCache.stats();
    expect(stats.size).toBe(1);
    expect(stats.oldest).toBeTypeOf('number');
    expect(stats.newest).toBeTypeOf('number');
  });

  it('stats returns null timestamps for empty cache', () => {
    const stats = ResponseCache.stats();
    expect(stats.size).toBe(0);
    expect(stats.oldest).toBeNull();
    expect(stats.newest).toBeNull();
  });

  it('different prompts produce different cache entries', () => {
    ResponseCache.set(key, 'first');
    ResponseCache.set(otherKey, 'second');
    expect(ResponseCache.get(key)).toBe('first');
    expect(ResponseCache.get(otherKey)).toBe('second');
  });

  it('custom TTL overrides default', () => {
    ResponseCache.set(key, 'short lived', 100);
    vi.advanceTimersByTime(200);
    expect(ResponseCache.get(key)).toBeNull();
  });
});
