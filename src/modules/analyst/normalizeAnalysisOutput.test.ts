import { describe, expect, it } from 'vitest';
import { normalizeAnalysisOutput } from './normalizeAnalysisOutput';

describe('normalizeAnalysisOutput', () => {
  it('normalizes nested arrays, numeric strings, and narrative aliases', () => {
    expect(normalizeAnalysisOutput({
      analysis: 'A short interpretation',
      rows: [{ category: 'North', amount: '1,250' }],
    })).toEqual({
      data: [{ category: 'North', amount: '1,250', label: 'North', value: 1250 }],
      narrative: 'A short interpretation',
    });
  });

  it('rejects responses with no chartable numeric values', () => {
    expect(() => normalizeAnalysisOutput({ data: [{ label: 'Empty' }] })).toThrow('No chartable');
  });
});
