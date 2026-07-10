import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

/**
 * Keeps an unsent composer draft per chat session so it survives module
 * switches (Chat -> Settings -> Chat, etc.) and app restarts. Previously the
 * composer text lived only in local React state inside useChatState, so
 * navigating away from the Chat module (which unmounts ChatModule) wiped
 * out anything the user had typed but not yet sent.
 */
interface DraftState {
  drafts: Record<string, string>;
  getDraft: (sessionId: string | null | undefined) => string;
  setDraft: (sessionId: string | null | undefined, value: string) => void;
  clearDraft: (sessionId: string | null | undefined) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},

      getDraft: (sessionId) => {
        if (!sessionId) return '';
        return get().drafts[sessionId] ?? '';
      },

      setDraft: (sessionId, value) => {
        if (!sessionId) return;
        set((s) => {
          if (!value) {
            if (!(sessionId in s.drafts)) return {};
            const next = { ...s.drafts };
            delete next[sessionId];
            return { drafts: next };
          }
          if (s.drafts[sessionId] === value) return {};
          return { drafts: { ...s.drafts, [sessionId]: value } };
        });
      },

      clearDraft: (sessionId) => {
        if (!sessionId) return;
        set((s) => {
          if (!(sessionId in s.drafts)) return {};
          const next = { ...s.drafts };
          delete next[sessionId];
          return { drafts: next };
        });
      },
    }),
    {
      name: 'gia-draft-storage',
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
