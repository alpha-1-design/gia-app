import { describe, it, expect } from 'vitest';
import {
  extractJSON,
  getIntervalMs,
  formatNextRun,
  notifId,
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
