import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

interface WriterState {
  prompt: string;
  draft: string;
  format: string;
  wordTarget: number;
  setPrompt: (prompt: string) => void;
  setDraft: (draft: string) => void;
  setFormat: (format: string) => void;
  setWordTarget: (target: number) => void;
  clearDraft: () => void;
}

export const useWriterStore = create<WriterState>()(
  persist(
    (set) => ({
      prompt: '',
      draft: '',
      format: 'Email',
      wordTarget: 400,

      setPrompt: (prompt) => set({ prompt }),
      setDraft: (draft) => set({ draft }),
      setFormat: (format) => set({ format }),
      setWordTarget: (wordTarget) => set({ wordTarget }),
      clearDraft: () => set({ draft: '', prompt: '' }),
    }),
    {
      name: 'gia-writer-storage',
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
