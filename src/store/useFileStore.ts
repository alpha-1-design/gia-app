import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
  tags: string[];
  uploadedAt: number;
  lastReferencedAt?: number;
  source: 'chat_upload' | 'manual' | 'capture';
  messageId?: string;
  sessionId?: string;
}

interface FileStore {
  files: StoredFile[];
  addFile: (file: Omit<StoredFile, 'id' | 'uploadedAt'>) => string;
  deleteFile: (id: string) => void;
  updateFile: (id: string, updates: Partial<StoredFile>) => void;
  getFile: (id: string) => StoredFile | undefined;
  searchFiles: (query: string) => StoredFile[];
  filterByTag: (tag: string) => StoredFile[];
  filterByType: (type: string) => StoredFile[];
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  touchFile: (id: string) => void;
  getAllTags: () => string[];
}

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      files: [],

      addFile: (input) => {
        const id = genId();
        const file: StoredFile = { ...input, id, uploadedAt: Date.now() };
        set(s => ({ files: [...s.files, file] }));
        return id;
      },

      deleteFile: (id) => {
        set(s => ({ files: s.files.filter(f => f.id !== id) }));
      },

      updateFile: (id, updates) => {
        set(s => ({
          files: s.files.map(f => f.id === id ? { ...f, ...updates } : f),
        }));
      },

      getFile: (id) => get().files.find(f => f.id === id),

      searchFiles: (query) => {
        const q = query.toLowerCase();
        return get().files.filter(f =>
          f.name.toLowerCase().includes(q) ||
          f.tags.some(t => t.toLowerCase().includes(q)) ||
          f.content.toLowerCase().includes(q)
        );
      },

      filterByTag: (tag) => {
        return get().files.filter(f => f.tags.includes(tag));
      },

      filterByType: (type) => {
        return get().files.filter(f => f.type.startsWith(type));
      },

      addTag: (id, tag) => {
        set(s => ({
          files: s.files.map(f =>
            f.id === id && !f.tags.includes(tag)
              ? { ...f, tags: [...f.tags, tag] }
              : f
          ),
        }));
      },

      removeTag: (id, tag) => {
        set(s => ({
          files: s.files.map(f =>
            f.id === id
              ? { ...f, tags: f.tags.filter(t => t !== tag) }
              : f
          ),
        }));
      },

      touchFile: (id) => {
        set(s => ({
          files: s.files.map(f =>
            f.id === id ? { ...f, lastReferencedAt: Date.now() } : f
          ),
        }));
      },

      getAllTags: () => {
        const tags = new Set<string>();
        for (const f of get().files) {
          for (const t of f.tags) tags.add(t);
        }
        return Array.from(tags).sort();
      },
    }),
    {
      name: 'gia-files',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ files: state.files }),
    }
  )
);

export function fileStoreHelpers() {
  const { files } = useFileStore.getState();
  return {
    async attachFromMessage(messageId: string) {
      return files.filter(f => f.messageId === messageId);
    },
    async attachFromSession(sessionId: string) {
      return files.filter(f => f.sessionId === sessionId);
    },
    totalSize() {
      return files.reduce((sum, f) => sum + f.size, 0);
    },
    countByType() {
      const counts: Record<string, number> = {};
      for (const f of files) {
        const cat = f.type.split('/')[0] || 'unknown';
        counts[cat] = (counts[cat] || 0) + 1;
      }
      return counts;
    },
  };
}
