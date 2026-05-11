import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type MemoryCategory = 'profile' | 'subject' | 'score' | 'weak_area' | 'fact' | 'preference' | 'session_summary';

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  confidence: number;
  timestamp: number;
  lastAccessed: number;
}

const MAX_MEMORIES = 200;

const genId = () => Math.random().toString(36).slice(2, 10);

interface MemoryState {
  memories: MemoryEntry[];
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'timestamp' | 'lastAccessed'>) => void;
  addMemories: (entries: Omit<MemoryEntry, 'id' | 'timestamp' | 'lastAccessed'>[]) => void;
  getMemories: (category?: MemoryCategory) => MemoryEntry[];
  queryMemories: (query: string) => MemoryEntry[];
  deleteMemory: (id: string) => void;
  clearMemories: () => void;
  getRelevantContext: () => string;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      memories: [],

      addMemory: (entry) => set((s) => {
        const existing = s.memories.find((m) => m.key === entry.key);
        if (existing) {
          return {
            memories: s.memories.map((m) =>
              m.key === entry.key
                ? { ...m, value: entry.value, confidence: Math.max(m.confidence, entry.confidence), category: entry.category, timestamp: Date.now(), lastAccessed: Date.now() }
                : m
            ),
          };
        }
        const newMem: MemoryEntry = {
          ...entry,
          id: genId(),
          timestamp: Date.now(),
          lastAccessed: Date.now(),
        };
        const sorted = [newMem, ...s.memories].sort((a, b) => b.confidence - a.confidence);
        return { memories: sorted.slice(0, MAX_MEMORIES) };
      }),

      addMemories: (entries) => {
        const state = get();
        entries.forEach((entry) => state.addMemory(entry));
      },

      getMemories: (category) => {
        const { memories } = get();
        return category ? memories.filter((m) => m.category === category) : [...memories];
      },

      queryMemories: (query) => {
        const { memories } = get();
        const lower = query.toLowerCase();
        return memories
          .filter((m) => m.key.toLowerCase().includes(lower) || m.value.toLowerCase().includes(lower))
          .sort((a, b) => b.lastAccessed - a.lastAccessed)
          .slice(0, 15);
      },

      deleteMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),

      clearMemories: () => set({ memories: [] }),

      getRelevantContext: () => {
        const { memories } = get();
        const top = [...memories].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
        if (top.length === 0) return '';

        const sections: string[] = [];
        const byCategory = (cat: MemoryCategory) => top.filter((m) => m.category === cat);

        const profile = byCategory('profile');
        if (profile.length > 0) sections.push(`GIA knows you: ${profile.map((m) => `${m.key}: ${m.value}`).join(', ')}`);

        const subjects = byCategory('subject');
        if (subjects.length > 0) sections.push(`Studying: ${subjects.map((m) => m.value).join(', ')}`);

        const weak = byCategory('weak_area');
        if (weak.length > 0) sections.push(`Weak areas: ${weak.map((m) => m.value).join(', ')}`);

        const scores = byCategory('score');
        if (scores.length > 0) sections.push(`Recent scores: ${scores.map((m) => `${m.key}: ${m.value}`).join(', ')}`);

        const facts = byCategory('fact').slice(0, 5);
        if (facts.length > 0) sections.push(`Facts: ${facts.map((m) => m.value).join(', ')}`);

        return sections.length > 0 ? `\n\nStored memory:\n${sections.join('\n')}` : '';
      },
    }),
    {
      name: 'gia-memory-store-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ memories: s.memories }),
    }
  )
);
