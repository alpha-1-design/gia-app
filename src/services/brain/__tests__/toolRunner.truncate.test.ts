import { describe, expect, it } from 'vitest';
import { truncateObservation } from '../toolRunner';

describe('truncateObservation', () => {
  it('leaves small tool output untouched', () => {
    const small = 'line one\nline two';
    expect(truncateObservation(small)).toBe(small);
  });

  it('caps very large output and tells the model how to narrow it', () => {
    const big = 'x'.repeat(60 * 1024);
    const result = truncateObservation(big);

    expect(result.length).toBeLessThan(big.length);
    expect(result).toMatch(/\[Output truncated/);
    expect(result).toContain((50 * 1024).toLocaleString());
    expect(result).toContain(big.length.toLocaleString());
  });

  it('caps output that is within the byte limit but over the line limit', () => {
    const manyLines = Array.from({ length: 2500 }, (_, i) => `line ${i}`).join('\n');
    const result = truncateObservation(manyLines);

    expect(result.split('\n').length).toBeLessThan(2100);
    expect(result).toMatch(/\[Output truncated/);
  });
});
