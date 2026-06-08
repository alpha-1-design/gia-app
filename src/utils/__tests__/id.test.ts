import { describe, it, expect } from 'vitest';
import { genId } from '../id';

describe('genId', () => {
  it('returns a string', () => {
    const id = genId();
    expect(typeof id).toBe('string');
  });

  it('returns a non-empty string', () => {
    const id = genId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns 8 characters', () => {
    const id = genId();
    expect(id.length).toBe(8);
  });

  it('uses only alphanumeric characters', () => {
    const id = genId();
    expect(id).toMatch(/^[0-9a-z]+$/);
  });

  it('returns different values on successive calls', () => {
    const a = genId();
    const b = genId();
    expect(a).not.toBe(b);
  });

  it('returns unique values over many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => genId()));
    expect(ids.size).toBe(1000);
  });
});
