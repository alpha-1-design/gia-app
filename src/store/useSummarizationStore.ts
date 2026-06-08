import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export interface SessionSummary {
  id: string;
  sessionId: string;
  branchId: string;
  summary: string;
  tokensSaved: number;
  originalMsgCount: number;
  summarizedMsgIds: string[];
  createdAt: number;
}

interface SummarizationState {
  sessionSummaries: Record<string, SessionSummary[]>; // keyed by sessionId
  contextWindowLimit: number; // approximate token limit before summarization triggers
  addSummary: (sessionId: string, branchId: string, summary: string, tokensSaved: number, originalMsgCount: number, msgIds: string[]) => void;
  getSummaries: (sessionId: string, branchId: string) => SessionSummary[];
  clearSummaries: (sessionId: string) => void;
  setContextWindowLimit: (limit: number) => void;
}

export const useSummarizationStore = create<SummarizationState>()(
  persist(
    (set, get) => ({
      sessionSummaries: {},
      contextWindowLimit: 8000,

      addSummary: (sessionId, branchId, summary, tokensSaved, originalMsgCount, msgIds) =>
        set((s) => {
          const entry: SessionSummary = {
            id: genId(),
            sessionId,
            branchId,
            summary,
            tokensSaved,
            originalMsgCount,
            summarizedMsgIds: msgIds,
            createdAt: Date.now(),
          };
          const existing = s.sessionSummaries[sessionId] || [];
          return {
            sessionSummaries: {
              ...s.sessionSummaries,
              [sessionId]: [entry, ...existing],
            },
          };
        }),

      getSummaries: (sessionId, branchId) => {
        const entries = get().sessionSummaries[sessionId] || [];
        return entries.filter((e) => e.branchId === branchId);
      },

      clearSummaries: (sessionId) =>
        set((s) => {
          const n = { ...s.sessionSummaries };
          delete n[sessionId];
          return { sessionSummaries: n };
        }),

      setContextWindowLimit: (limit) => set({ contextWindowLimit: limit }),
    }),
    {
      name: 'gia-summarization-store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        sessionSummaries: s.sessionSummaries,
        contextWindowLimit: s.contextWindowLimit,
      }),
    }
  )
);
