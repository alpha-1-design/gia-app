import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type MCPTransportType = 'sse' | 'stdio';

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransportType;
  url: string;
  command: string;
  args: string[];
  enabled: boolean;
  autoConnect: boolean;
}

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPConnectionState {
  status: MCPConnectionStatus;
  error?: string;
  toolCount: number;
}

interface MCPStoreState {
  servers: MCPServerConfig[];
  connections: Record<string, MCPConnectionState>;
  addServer: (config: Omit<MCPServerConfig, 'id'>) => string;
  removeServer: (id: string) => void;
  updateServer: (id: string, config: Partial<MCPServerConfig>) => void;
  setConnectionState: (id: string, state: MCPConnectionState) => void;
  getServer: (id: string) => MCPServerConfig | undefined;
}

export const useMCPStore = create<MCPStoreState>()(
  persist(
    (set, get) => ({
      servers: [
        {
          id: 'mcp-local-bridge',
          name: 'GIA Stdio Bridge',
          transport: 'sse',
          url: 'http://localhost:3080',
          command: '',
          args: [],
          enabled: false,
          autoConnect: true,
        },
        {
          id: 'mcp-local-ollama',
          name: 'Local Ollama',
          transport: 'sse',
          url: 'http://localhost:11434',
          command: '',
          args: [],
          enabled: false,
          autoConnect: true,
        },
      ],
      connections: {},

      addServer: (config) => {
        const id = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          servers: [...s.servers, { ...config, id }],
        }));
        return id;
      },

      removeServer: (id) =>
        set((s) => ({
          servers: s.servers.filter((sv) => sv.id !== id),
          connections: Object.fromEntries(
            Object.entries(s.connections).filter(([k]) => k !== id)
          ),
        })),

      updateServer: (id, config) =>
        set((s) => ({
          servers: s.servers.map((sv) =>
            sv.id === id ? { ...sv, ...config } : sv
          ),
        })),

      setConnectionState: (id, state) =>
        set((s) => ({
          connections: { ...s.connections, [id]: state },
        })),

      getServer: (id) => get().servers.find((s) => s.id === id),
    }),
    {
      name: 'gia-mcp-storage-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ servers: s.servers }),
    }
  )
);
