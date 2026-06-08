import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export type MemoryCategory = 'profile' | 'subject' | 'score' | 'weak_area' | 'fact' | 'preference' | 'session_summary' | 'project' | 'correction' | 'emotion' | 'goal';

export type MemoryTier = 'working' | 'semantic' | 'episodic';

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  tier: MemoryTier;
  confidence: number;
  timestamp: number;
  lastAccessed: number;
}

const MAX_MEMORIES = 300;
const WORKING_MEMORY_MAX = 20;
const CONFIDENCE_DECAY = 0.97;
const DECAY_THRESHOLD = 0.2;
const QUERY_MAX_WORDS = 8;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we',
  'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'theirs',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'as', 'until', 'while', 'about', 'between', 'through',
  'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out',
  'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'not', 'no', 'nor', 'not',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function wordVector(words: string[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const w of words) {
    vec.set(w, (vec.get(w) || 0) + 1);
  }
  const mag = Math.sqrt([...vec.values()].reduce((s, v) => s + v * v, 0)) || 1;
  for (const [k, v] of vec) vec.set(k, v / mag);
  return vec;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) {
    if (b.has(k)) dot += v * b.get(k)!;
  }
  return dot;
}

function ngramTokens(text: string, n: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length >= n);
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(' '));
  }
  return grams;
}

function relevanceScore(memory: MemoryEntry, query?: string): number {
  let score = memory.confidence;
  if (!query) return score;

  const text = `${memory.key} ${memory.value}`.toLowerCase();
  const q = query.toLowerCase();

  // Vector (semantic) similarity — primary signal
  const memTokens = tokenize(text);
  const queryTokens = tokenize(q);
  if (memTokens.length > 0 && queryTokens.length > 0) {
    const memVec = wordVector(memTokens);
    const queryVec = wordVector(queryTokens);
    score += cosineSimilarity(memVec, queryVec) * 2.0;
  }

  // Exact match — strong secondary signal
  if (text.includes(q)) { score += 1.0; }

  // Ngram overlap — tertiary signal for partial/phrase matches
  const queryWords = q.split(/\s+/).filter(w => w.length > 2).slice(0, QUERY_MAX_WORDS);
  const matchCount = queryWords.filter(w => text.includes(w)).length;
  score += (matchCount / Math.max(queryWords.length, 1)) * 0.5;

  for (const n of [2, 3]) {
    const memGrams = ngramTokens(text, n);
    const queryGrams = ngramTokens(q, n);
    if (queryGrams.size > 0 && memGrams.size > 0) {
      const intersection = new Set([...memGrams].filter(g => queryGrams.has(g)));
      score += (intersection.size / queryGrams.size) * 0.3;
    }
  }

  return score;
}

interface MemoryState {
  memories: MemoryEntry[];
  addMemory: (entry: Omit<MemoryEntry, 'id' | 'timestamp' | 'lastAccessed'>) => void;
  addMemories: (entries: Omit<MemoryEntry, 'id' | 'timestamp' | 'lastAccessed'>[]) => void;
  getMemories: (category?: MemoryCategory) => MemoryEntry[];
  queryMemories: (query: string) => MemoryEntry[];
  deleteMemory: (id: string) => void;
  clearMemories: () => void;
  getRelevantContext: (query?: string) => string;
  compactMemories: () => void;
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
                ? { ...m, value: entry.value, confidence: Math.max(m.confidence, entry.confidence), category: entry.category, tier: entry.tier, timestamp: Date.now(), lastAccessed: Date.now() }
                : m
            ),
          };
        }
        const newMem: MemoryEntry = {
          ...entry,
          tier: entry.tier || 'semantic',
          id: genId(),
          timestamp: Date.now(),
          lastAccessed: Date.now(),
        };
        const sorted = [newMem, ...s.memories].sort((a, b) => b.confidence - a.confidence);
        return { memories: sorted.slice(0, MAX_MEMORIES) };
      }),

      addMemories: (entries) => set((s) => {
        const updated = [...s.memories];
        for (const entry of entries) {
          const existingIdx = updated.findIndex((m) => m.key === entry.key);
          if (existingIdx >= 0) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              value: entry.value,
              confidence: Math.max(updated[existingIdx].confidence, entry.confidence),
              category: entry.category,
              tier: entry.tier || updated[existingIdx].tier,
              timestamp: Date.now(),
              lastAccessed: Date.now(),
            };
          } else {
            updated.push({
              ...entry,
              tier: entry.tier || 'semantic',
              id: genId(),
              timestamp: Date.now(),
              lastAccessed: Date.now(),
            });
          }
        }
        updated.sort((a, b) => b.confidence - a.confidence);
        return { memories: updated.slice(0, MAX_MEMORIES) };
      }),

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

        const now = Date.now();
        const DAY_MS = 86400000;

        const scored = memories.map(m => {
          let score = relevanceScore(m, query);

          const ageDays = (now - m.lastAccessed) / DAY_MS;
          if (ageDays > 30) score *= Math.pow(CONFIDENCE_DECAY, ageDays / 7);

          if (m.tier === 'working') score *= 1.3;
          if (m.tier === 'episodic') score *= 0.8;

          return { ...m, relevanceScore: score };
        });

        const top = scored
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 15);

        set((s) => ({
          memories: s.memories.map(m => {
            const matched = top.find(t => t.id === m.id);
            if (matched) return { ...m, lastAccessed: Date.now() };
            return m;
          }),
        }));

        if (top.length === 0) return '';

        const workingMems = top.filter(m => m.tier === 'working');
        const semanticMems = top.filter(m => m.tier === 'semantic' && m.relevanceScore > DECAY_THRESHOLD);
        const episodicMems = top.filter(m => m.tier === 'episodic' && m.relevanceScore > DECAY_THRESHOLD);

        const lines: string[] = [];
        if (workingMems.length > 0) {
          lines.push('## Active Context:');
          workingMems.forEach(m => lines.push(`- ${m.key}: ${m.value}`));
        }
        if (semanticMems.length > 0) {
          lines.push('## Facts:');
          semanticMems.forEach(m => lines.push(`- ${m.key}: ${m.value}`));
        }
        if (episodicMems.length > 0) {
          lines.push('## History:');
          episodicMems.forEach(m => lines.push(`- ${m.value.slice(0, 200)}`));
        }

        return `\n\n## What GIA remembers:\n${lines.join('\n')}`;
      },

      compactMemories: () => set((s) => {
        const now = Date.now();
        const DAY_MS = 86400000;

        let pruned = s.memories
          .filter(m => m.tier !== 'working' || (now - m.lastAccessed) < DAY_MS);

        if (pruned.length > MAX_MEMORIES) {
          pruned = pruned
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, MAX_MEMORIES);
        }

        const merged: MemoryEntry[] = [];
        for (const mem of pruned) {
          const existing = merged.find(m =>
            m.key === mem.key || (
              m.category === mem.category &&
              (m.value.includes(mem.value) || mem.value.includes(m.value))
            )
          );
          if (existing) {
            const idx = merged.indexOf(existing);
            merged[idx] = {
              ...existing,
              value: mem.value.length > existing.value.length ? mem.value : existing.value,
              confidence: Math.max(existing.confidence, mem.confidence),
              lastAccessed: Math.max(existing.lastAccessed, mem.lastAccessed),
            };
          } else {
            merged.push({ ...mem });
          }
        }

        merged.sort((a, b) => b.confidence - a.confidence);
        const working = merged.filter(m => m.tier === 'working').slice(0, WORKING_MEMORY_MAX);
        const others = merged.filter(m => m.tier !== 'working').slice(0, MAX_MEMORIES - working.length);
        return { memories: [...working, ...others] };
      }),
    }),
    {
      name: 'gia-memory-store-v2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ memories: s.memories }),
    }
  )
);
