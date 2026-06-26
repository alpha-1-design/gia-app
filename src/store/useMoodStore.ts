import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type MoodLabel = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

export interface MoodEntry {
  timestamp: number;
  label: MoodLabel;
  score: number;
  context: string;
  source: 'message' | 'voice' | 'manual' | 'automatic';
}

interface MoodState {
  entries: MoodEntry[];
  addEntry: (entry: Omit<MoodEntry, 'timestamp'>) => void;
  getCurrentMood: () => MoodLabel;
  getMoodTrend: (hours?: number) => number;
  getRecentMoods: (count?: number) => MoodEntry[];
  getMoodSummary: (hours?: number) => string;
  clear: () => void;
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) =>
        set((s) => ({
          entries: [...s.entries, { ...entry, timestamp: Date.now() }].slice(-1000),
        })),

      getCurrentMood: () => {
        const entries = get().entries;
        if (entries.length === 0) return 'neutral';
        return entries[entries.length - 1].label;
      },

      getMoodTrend: (hours = 24) => {
        const cutoff = Date.now() - hours * 3600000;
        const recent = get().entries.filter((e) => e.timestamp > cutoff);
        if (recent.length === 0) return 0;
        return recent.reduce((sum, e) => sum + e.score, 0) / recent.length;
      },

      getRecentMoods: (count = 10) =>
        get().entries.slice(-count).reverse(),

      getMoodSummary: (hours = 24) => {
        const cutoff = Date.now() - hours * 3600000;
        const recent = get().entries.filter((e) => e.timestamp > cutoff);
        if (recent.length === 0) return 'No mood data available.';

        const avg = recent.reduce((s, e) => s + e.score, 0) / recent.length;
        const labels = recent.map((e) => e.label);
        const dominant = labels.sort((a, b) =>
          labels.filter((v) => v === a).length - labels.filter((v) => v === b).length
        ).pop();

        return `Mood over ${hours}h: ${dominant} (avg ${avg.toFixed(2)}/1.0 from ${recent.length} readings)`;
      },

      clear: () => set({ entries: [] }),
    }),
    {
      name: 'gia-mood-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ entries: s.entries }),
    }
  )
);
