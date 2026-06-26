import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type SyncProvider = 'google_drive' | 'icloud' | 'webdav' | 's3' | 'custom';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'paused';
export type SyncScope = 'all' | 'memories' | 'notes' | 'knowledge_graph' | 'twin' | 'settings';

export interface SyncConfig {
  enabled: boolean;
  provider: SyncProvider;
  endpoint: string;
  encrypted: boolean;
  encryptionKey: string;
  intervalMs: number;
  scope: SyncScope[];
  lastSync: number | null;
  status: SyncStatus;
  error: string | null;
}

interface SyncState {
  config: SyncConfig;
  updateConfig: (updates: Partial<SyncConfig>) => void;
  setStatus: (status: SyncStatus) => void;
  setError: (error: string | null) => void;
  recordSync: () => void;
  clear: () => void;
}

const defaultConfig: SyncConfig = {
  enabled: false,
  provider: 'webdav',
  endpoint: '',
  encrypted: true,
  encryptionKey: '',
  intervalMs: 300000,
  scope: ['memories', 'notes', 'settings'],
  lastSync: null,
  status: 'idle',
  error: null,
};

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      config: { ...defaultConfig },

      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates } })),

      setStatus: (status) =>
        set((s) => ({ config: { ...s.config, status } })),

      setError: (error) =>
        set((s) => ({ config: { ...s.config, error } })),

      recordSync: () =>
        set((s) => ({ config: { ...s.config, lastSync: Date.now(), status: 'idle' } })),

      clear: () => set({ config: { ...defaultConfig } }),
    }),
    {
      name: 'gia-sync-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ config: s.config }),
    }
  )
);
