import { describe, it, expect, afterEach } from 'vitest';
import {
  extractJSON,
  getIntervalMs,
  formatNextRun,
  notifId,
  isNativePlatform,
  featureAvailable,
  featureFallbackMessage,
} from '../helpers';

describe('extractJSON', () => {
  it('extracts JSON object from plain text', () => {
    const result = extractJSON('{"name": "test", "value": 42}');
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('extracts JSON array from surrounding text', () => {
    const result = extractJSON('Here is the result: [1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('extracts JSON object from surrounding text', () => {
    const result = extractJSON('Response: {"key": "val"}');
    expect(result).toEqual({ key: 'val' });
  });

  it('extracts JSON from markdown code block', () => {
    const result = extractJSON('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('fixes trailing commas', () => {
    const result = extractJSON('{"a": 1, "b": 2,}');
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles unquoted keys', () => {
    const result = extractJSON('{name: "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('throws on completely invalid input', () => {
    expect(() => extractJSON('not json at all')).toThrow();
  });

  it('extracts the first JSON object from text', () => {
    const result = extractJSON('Tool result: {"real": "data"}');
    expect(result).toEqual({ real: 'data' });
  });

  it('repairs truncated JSON with missing closing brace', () => {
    const result = extractJSON('{"a": 1, "b": {"c": 2');
    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  it('repairs truncated JSON array', () => {
    const result = extractJSON('[1, 2, 3');
    expect(result).toEqual([1, 2, 3]);
  });

  it('repairs truncated JSON with unclosed string', () => {
    const result = extractJSON('{"name": "hello');
    expect(result).toEqual({ name: 'hello' });
  });

  it('handles deeply nested truncated JSON', () => {
    const result = extractJSON('{"level1": {"level2": {"level3": "deep"}');
    expect(result).toEqual({ level1: { level2: { level3: 'deep' } } });
  });

  it('extracts with leading text before JSON', () => {
    const result = extractJSON('Here is the result: {"x": 1, "y": 2}');
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it('extracts from content with JSON array in code block', () => {
    const result = extractJSON('```json\n[{"id": 1}, {"id": 2}]\n```');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('fixes trailing comma and unquoted key together', () => {
    const result = extractJSON('{name: "alice", age: 30,}');
    expect(result).toEqual({ name: 'alice', age: 30 });
  });
});

describe('getIntervalMs', () => {
  it('returns 1 hour for hourly', () => {
    expect(getIntervalMs('hourly')).toBe(3600000);
  });
  it('returns 1 day for daily', () => {
    expect(getIntervalMs('daily')).toBe(86400000);
  });
  it('returns 1 week for weekly', () => {
    expect(getIntervalMs('weekly')).toBe(604800000);
  });
});

describe('formatNextRun', () => {
  it('returns "now" for past timestamps', () => {
    expect(formatNextRun(Date.now() - 1000)).toBe('now');
  });

  it('returns minutes for < 1 hour', () => {
    const in15min = Date.now() + 15 * 60 * 1000;
    const result = formatNextRun(in15min);
    expect(result).toMatch(/in \d+m/);
  });

  it('returns hours for < 1 day', () => {
    const in2h = Date.now() + 2 * 3600 * 1000;
    const result = formatNextRun(in2h);
    expect(result).toMatch(/in \d+h/);
  });
});

describe('notifId', () => {
  it('returns a number', () => {
    const id = notifId();
    expect(typeof id).toBe('number');
  });

  it('returns different values on successive calls', () => {
    const a = notifId();
    const b = notifId();
    expect(a).not.toBe(b);
  });
});

describe('isNativePlatform', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('returns false when window is undefined', () => {
    const win = globalThis.window;
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true });
    expect(isNativePlatform()).toBe(false);
    Object.defineProperty(globalThis, 'window', { value: win, writable: true, configurable: true });
  });

  it('returns false when Capacitor is not present', () => {
    expect(isNativePlatform()).toBe(false);
  });

  it('returns false when isNativePlatform returns false', () => {
    (globalThis as Record<string, unknown>).Capacitor = { isNativePlatform: () => false };
    expect(isNativePlatform()).toBe(false);
    delete (globalThis as Record<string, unknown>).Capacitor;
  });

  it('returns true when isNativePlatform returns true', () => {
    (globalThis as Record<string, unknown>).Capacitor = { isNativePlatform: () => true };
    expect(isNativePlatform()).toBe(true);
    delete (globalThis as Record<string, unknown>).Capacitor;
  });
});

describe('featureAvailable', () => {
  it('returns true for codeRunner', () => {
    expect(featureAvailable('codeRunner')).toBe(true);
  });

  it('returns true for browserNav', () => {
    expect(featureAvailable('browserNav')).toBe(true);
  });

  it('returns false for unknown feature', () => {
    expect(featureAvailable('unknown' as never)).toBe(false);
  });
});

describe('featureFallbackMessage', () => {
  it('returns empty string for supported features', () => {
    expect(featureFallbackMessage('codeRunner')).toBe('');
  });

  it('returns fallback message for unsupported feature', () => {
    const msg = featureFallbackMessage('filesystem');
    expect(msg).toContain('File system access');
  });

  it('returns "Not available" for unknown feature', () => {
    expect(featureFallbackMessage('unknown' as never)).toBe('Not available');
  });
});
