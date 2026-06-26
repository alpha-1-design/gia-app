import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export interface WritingSample {
  id: string;
  text: string;
  timestamp: number;
  context: 'chat' | 'note' | 'task' | 'goal' | 'other';
}

export interface StyleProfile {
  formality: number;
  verbosity: number;
  emojiUsage: number;
  technicalLevel: number;
  sentimentBias: number;
  commonPhrases: string[];
  avgSentenceLength: number;
  vocabularyRichness: number;
}

export interface TwinModel {
  userId: string;
  styleProfile: StyleProfile;
  samples: WritingSample[];
  preferences: Record<string, string>;
  lastLearned: number;
  confidence: number;
}

interface TwinState {
  twin: TwinModel | null;
  setUserId: (id: string) => void;
  addSample: (sample: Omit<WritingSample, 'id' | 'timestamp'>) => void;
  updateProfile: (updates: Partial<StyleProfile>) => void;
  setPreference: (key: string, value: string) => void;
  getPreference: (key: string) => string | undefined;
  clear: () => void;
}

const defaultProfile: StyleProfile = {
  formality: 0.5,
  verbosity: 0.5,
  emojiUsage: 0.3,
  technicalLevel: 0.5,
  sentimentBias: 0.5,
  commonPhrases: [],
  avgSentenceLength: 15,
  vocabularyRichness: 0.5,
};

export const useTwinStore = create<TwinState>()(
  persist(
    (set, get) => ({
      twin: null,

      setUserId: (userId) =>
        set((s) => ({
          twin: s.twin ? { ...s.twin, userId } : { userId, styleProfile: { ...defaultProfile }, samples: [], preferences: {}, lastLearned: 0, confidence: 0 },
        })),

      addSample: (sample) =>
        set((s) => {
          if (!s.twin) return s;
          const newSample: WritingSample = {
            ...sample,
            id: genId(),
            timestamp: Date.now(),
          };
          const samples = [...s.twin.samples, newSample].slice(-500);
          return {
            twin: { ...s.twin, samples, lastLearned: Date.now() },
          };
        }),

      updateProfile: (updates) =>
        set((s) => ({
          twin: s.twin
            ? { ...s.twin, styleProfile: { ...s.twin.styleProfile, ...updates }, lastLearned: Date.now() }
            : s.twin,
        })),

      setPreference: (key, value) =>
        set((s) => ({
          twin: s.twin
            ? { ...s.twin, preferences: { ...s.twin.preferences, [key]: value }, lastLearned: Date.now() }
            : s.twin,
        })),

      getPreference: (key) => get().twin?.preferences[key],
      clear: () => set({ twin: null }),
    }),
    {
      name: 'gia-twin-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ twin: s.twin }),
    }
  )
);
