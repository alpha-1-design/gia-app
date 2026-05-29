import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export interface GiaNote {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface NotesState {
  notes: GiaNote[];
  addNote: (note: Omit<GiaNote, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<GiaNote>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  searchNotes: (query: string) => GiaNote[];
  getNote: (id: string) => GiaNote | undefined;
}

const COLORS = [
  '#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5',
  '#e0e7ff', '#fae8ff', '#fff7ed', '#ecfdf5',
];

export function randomNoteColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      addNote: (note) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((s) => ({
          notes: [{ ...note, id, createdAt: now, updatedAt: now }, ...s.notes],
        }));
        return id;
      },

      updateNote: (id, updates) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
          ),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      togglePin: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
          ),
        })),

      searchNotes: (query) => {
        const q = query.toLowerCase();
        return get().notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
        );
      },

      getNote: (id) => get().notes.find((n) => n.id === id),
    }),
    {
      name: 'gia-notes-v1',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
