import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

interface WriterDraftState {
  prompt: string;
  draft: string;
  format: string;
  wordTarget: number;
  setPrompt: (v: string) => void;
  setDraft: (v: string) => void;
  setFormat: (v: string) => void;
  setWordTarget: (v: number) => void;
  clearDraft: () => void;
}

export const useWriterStore = create<WriterDraftState>()(
  persist(
    (set) => ({
      prompt: '',
      draft: '',
      format: 'Essay',
      wordTarget: 300,
      setPrompt: (prompt) => set({ prompt }),
      setDraft: (draft) => set({ draft }),
      setFormat: (format) => set({ format }),
      setWordTarget: (wordTarget) => set({ wordTarget }),
      clearDraft: () => set({ prompt: '', draft: '', format: 'Essay', wordTarget: 300 }),
    }),
    {
      name: 'gia-writer-draft',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
