import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type MemoryCategory = 'profile' | 'subject' | 'score' | 'weak_area' | 'fact' | 'preference' | 'session_summary' | 'project' | 'correction' | 'emotion' | 'goal';

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
  getRelevantContext: (query?: string) => string;
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

      getRelevantContext: (query?: string) => {
        const { memories } = get();
        if (memories.length === 0) return '';

        let scored = memories.map(m => ({ ...m, relevanceScore: m.confidence }));

        // Boost memories matching keywords in current query
        if (query) {
          const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          scored = scored.map(m => {
            const text = `${m.key} ${m.value}`.toLowerCase();
            const matches = words.filter(w => text.includes(w)).length;
            return { ...m, relevanceScore: m.confidence + (matches * 0.2) };
          });
        }

        const top = scored
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 15);

        if (top.length === 0) return '';

        const lines = top.map(m => `- ${m.key}: ${m.value}`);
        return `\n\n## What GIA remembers about you:\n${lines.join('\n')}`;
      },
    }),
    {
      name: 'gia-memory-store-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ memories: s.memories }),
    }
  )
);
