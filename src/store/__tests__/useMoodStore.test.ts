import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { useMoodStore } from '../useMoodStore';

describe('useMoodStore', () => {
  beforeEach(() => {
    useMoodStore.setState({ entries: [] });
  });

  it('has default state', () => {
    expect(useMoodStore.getState().entries).toEqual([]);
    expect(useMoodStore.getState().getCurrentMood()).toBe('neutral');
  });

  describe('addEntry', () => {
    it('adds entry with timestamp', () => {
      const before = Date.now();
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: 'user happy', source: 'message' });
      const entries = useMoodStore.getState().entries;
      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('positive');
      expect(entries[0].score).toBe(0.8);
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('adds multiple entries', () => {
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: '', source: 'message' });
      useMoodStore.getState().addEntry({ label: 'negative', score: 0.2, context: '', source: 'voice' });
      expect(useMoodStore.getState().entries).toHaveLength(2);
    });

    it('caps at 1000 entries', () => {
      for (let i = 0; i < 1010; i++) {
        useMoodStore.getState().addEntry({ label: 'neutral', score: 0.5, context: '', source: 'automatic' });
      }
      expect(useMoodStore.getState().entries.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getCurrentMood', () => {
    it('returns neutral when empty', () => {
      expect(useMoodStore.getState().getCurrentMood()).toBe('neutral');
    });

    it('returns label of most recent entry', () => {
      useMoodStore.getState().addEntry({ label: 'very_positive', score: 1.0, context: '', source: 'manual' });
      expect(useMoodStore.getState().getCurrentMood()).toBe('very_positive');
    });

    it('returns latest after multiple entries', () => {
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: '', source: 'manual' });
      useMoodStore.getState().addEntry({ label: 'very_negative', score: 0.1, context: '', source: 'manual' });
      expect(useMoodStore.getState().getCurrentMood()).toBe('very_negative');
    });
  });

  describe('getMoodTrend', () => {
    it('returns 0 when no entries', () => {
      expect(useMoodStore.getState().getMoodTrend(24)).toBe(0);
    });

    it('returns average score of recent entries', () => {
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: '', source: 'manual' });
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.6, context: '', source: 'manual' });
      const trend = useMoodStore.getState().getMoodTrend(24);
      expect(trend).toBeCloseTo(0.7, 1);
    });
  });

  describe('getRecentMoods', () => {
    it('returns recent entries in reverse order', () => {
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: 'first', source: 'manual' });
      useMoodStore.getState().addEntry({ label: 'negative', score: 0.2, context: 'second', source: 'manual' });
      const recent = useMoodStore.getState().getRecentMoods(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].context).toBe('second');
      expect(recent[1].context).toBe('first');
    });
  });

  describe('clear', () => {
    it('resets entries', () => {
      useMoodStore.getState().addEntry({ label: 'positive', score: 0.8, context: '', source: 'manual' });
      useMoodStore.getState().clear();
      expect(useMoodStore.getState().entries).toEqual([]);
      expect(useMoodStore.getState().getCurrentMood()).toBe('neutral');
    });
  });
});
