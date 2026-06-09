import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { ProtocolProposal, ProtocolAction } from '../types/protocol';

interface PendingConfirm {
  protocolId: string;
  resolve: (action: ProtocolAction) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

interface ProtocolStore {
  protocols: ProtocolProposal[];
  consoleProtocols: ProtocolProposal[];
  pendingConfirm: PendingConfirm | null;

  propose: (p: ProtocolProposal) => void;
  confirm: (protocolId: string) => void;
  reject: (protocolId: string) => void;
  modify: (protocolId: string, args: Record<string, unknown>) => void;
  setExecuting: (protocolId: string) => void;
  setProgress: (protocolId: string, progress: number, label: string) => void;
  setCompleted: (protocolId: string, result: string, sources?: { title: string; url: string }[]) => void;
  setFailed: (protocolId: string, error: string) => void;
  clearProtocols: () => void;
  clearConsoleProtocols: () => void;

  waitForConfirmation: (protocolId: string, timeoutMs?: number) => Promise<ProtocolAction>;
  resolvePending: (action: ProtocolAction) => void;
}

export const useProtocolStore = create<ProtocolStore>()(
  persist(
    (set, get) => ({
      protocols: [],
      consoleProtocols: [],
      pendingConfirm: null,

      propose: (p) => {
        set((s) => ({
          protocols: [...s.protocols, p],
          consoleProtocols: [...s.consoleProtocols, p],
        }));
      },

      confirm: (protocolId) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'confirmed' as const, confirmedAt: Date.now() } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'confirmed' as const, confirmedAt: Date.now() } : p
          ),
        }));
        get().resolvePending({ type: 'confirm', protocolId, timestamp: Date.now() });
      },

      reject: (protocolId) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'rejected' as const } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'rejected' as const } : p
          ),
        }));
        get().resolvePending({ type: 'reject', protocolId, timestamp: Date.now() });
      },

      modify: (protocolId, args) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'modified' as const, args } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'modified' as const, args } : p
          ),
        }));
        get().resolvePending({ type: 'modify', protocolId, modifiedArgs: args, timestamp: Date.now() });
      },

      setExecuting: (protocolId) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'executing' as const, executedAt: Date.now() } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'executing' as const, executedAt: Date.now() } : p
          ),
        }));
      },

      setProgress: (protocolId, progress, label) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, progress: Math.max(0, Math.min(1, progress)), progressLabel: label } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, progress: Math.max(0, Math.min(1, progress)), progressLabel: label } : p
          ),
        }));
      },

      setCompleted: (protocolId, result, sources) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'completed' as const, result, sources, completedAt: Date.now() } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'completed' as const, result, sources, completedAt: Date.now() } : p
          ),
        }));
      },

      setFailed: (protocolId, error) => {
        set((s) => ({
          protocols: s.protocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'failed' as const, error, completedAt: Date.now() } : p
          ),
          consoleProtocols: s.consoleProtocols.map((p) =>
            p.id === protocolId ? { ...p, state: 'failed' as const, error, completedAt: Date.now() } : p
          ),
        }));
      },

      clearProtocols: () => set({ protocols: [] }),
      clearConsoleProtocols: () => set({ consoleProtocols: [] }),

      waitForConfirmation: (protocolId, timeoutMs) => {
        return new Promise((resolve) => {
          const existing = get().pendingConfirm;
          if (existing?.timeout) clearTimeout(existing.timeout);

          const timeout = timeoutMs
            ? setTimeout(() => {
                get().reject(protocolId);
                resolve({ type: 'reject', protocolId, timestamp: Date.now() });
              }, timeoutMs)
            : undefined;

          set({ pendingConfirm: { protocolId, resolve, timeout } });
        });
      },

      resolvePending: (action) => {
        const pending = get().pendingConfirm;
        if (pending && pending.protocolId === action.protocolId) {
          if (pending.timeout) clearTimeout(pending.timeout);
          pending.resolve(action);
          set({ pendingConfirm: null });
        }
      },
    }),
    {
      name: 'gia-protocols',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ consoleProtocols: state.consoleProtocols }),
    }
  )
);
