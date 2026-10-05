import { describe, it, expect } from 'vitest';
import { extractLargeInsertion } from '../pasteDetect';

const big = 'lorem ipsum '.repeat(60); // 720 chars

describe('extractLargeInsertion', () => {
  it('ignores normal typing', () => {
    expect(extractLargeInsertion('hell', 'hello')).toBeNull();
  });
  it('ignores short pastes', () => {
    expect(extractLargeInsertion('see ', 'see https://example.com/some/link')).toBeNull();
  });
  it('catches a long paste into an empty field', () => {
    expect(extractLargeInsertion('', big)).toEqual({ inserted: big, remaining: '' });
  });
  it('keeps the text that was already typed around the paste', () => {
    const r = extractLargeInsertion('summarize  please', 'summarize ' + big + ' please');
    expect(r?.inserted).toBe(big);
    expect(r?.remaining).toBe('summarize  please');
  });
  it('catches a paste at the very start and very end', () => {
    expect(extractLargeInsertion('tail', big + 'tail')?.remaining).toBe('tail');
    expect(extractLargeInsertion('head', 'head' + big)?.remaining).toBe('head');
  });
  it('treats deletions and replacements of equal size as typing', () => {
    expect(extractLargeInsertion(big, big.slice(1))).toBeNull();
    expect(extractLargeInsertion('abc', 'xyz')).toBeNull();
  });
});
