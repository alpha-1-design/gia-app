import { describe, it, expect, vi } from 'vitest';
import OutputValidator from '../OutputValidator';

vi.mock('../../utils/jsonRepair', () => ({
  repairJson: vi.fn((s: string) => s.replace(/,\s*([}\]])/g, '$1')),
  findFenceClose: vi.fn((text: string, fromIdx: number) => {
    // Find the next triple backtick
    const idx = text.indexOf('```', fromIdx);
    return idx;
  }),
}));

describe('OutputValidator', () => {
  it('returns valid for clean text', () => {
    const result = OutputValidator.validate('Hello world');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('adds missing tool block closing fence', () => {
    const result = OutputValidator.validate('Some text\n```tool\ncode here');
    expect(result.issues).toContain('Added missing closing fence for tool block');
    expect(result.sanitized.endsWith('\n```')).toBe(true);
  });

  it('adds missing </think> closing tag', () => {
    const result = OutputValidator.validate('Lets think <think>this is a thought');
    expect(result.issues).toContain('Added missing </think> closing tag');
    expect(result.sanitized).toContain('</think>');
  });

  it('collapses excessive newlines', () => {
    const result = OutputValidator.validate('a\n\n\n\n\nb');
    expect(result.issues).toContain('Collapsed excessive consecutive newlines');
    expect(result.sanitized).toBe('a\n\n\nb');
  });

  it('removes stuck repeated word patterns', () => {
    const text = 'hello hello hello hello hello hello ';
    const result = OutputValidator.validate(text);
    expect(result.sanitized.length).toBeLessThan(text.length);
  });

  it('removes stuck character repetition', () => {
    const text = 'x'.repeat(60) + 'abc';
    const result = OutputValidator.validate(text);
    expect(result.issues.some(i => i.includes('stuck character repetition'))).toBe(true);
  });

  it('does not flag diverse characters', () => {
    const text = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';
    const result = OutputValidator.validate(text);
    expect(result.valid).toBe(true);
  });

  it('reports valid as false when issues exist', () => {
    const result = OutputValidator.validate('<think>unclosed');
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('handles empty string', () => {
    const result = OutputValidator.validate('');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('leaves valid JSON blocks untouched', () => {
    const text = 'Here is the data:\n```json\n{"key": "value"}\n```';
    const result = OutputValidator.validate(text);
    expect(result.sanitized).toContain('"key": "value"');
  });
});
