import { describe, it, expect } from 'vitest';
import { levelFromTimeDomain, pushLevel, formatDuration } from '../waveform';

describe('waveform helpers', () => {
  it('silence is zero and loud input saturates at one', () => {
    expect(levelFromTimeDomain(new Uint8Array(128).fill(128))).toBe(0);
    expect(levelFromTimeDomain(Uint8Array.from({ length: 128 }, (_, i) => (i % 2 ? 255 : 0)))).toBe(1);
    expect(levelFromTimeDomain([])).toBe(0);
  });
  it('keeps a rolling window and clamps levels', () => {
    let l: number[] = [];
    for (let i = 0; i < 5; i++) l = pushLevel(l, i / 4, 3);
    expect(l).toEqual([0.5, 0.75, 1]);
    expect(pushLevel([], 4, 3)).toEqual([1]);
    expect(pushLevel([], -1, 3)).toEqual([0]);
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7400)).toBe('0:07');
    expect(formatDuration(723000)).toBe('12:03');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
