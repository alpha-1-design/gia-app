import { create } from 'zustand';

export interface NexusAgentState {
  id: string;
  name: string;
  color: string;
  icon: string;
  role: string;
  task: string;
  status: 'spawning' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  /** Live activity line — updated as the agent's own thoughts/tool calls stream in. */
  currentActivity?: string;
  duration: number;
  startedAt: number;
}

export interface NexusRun {
  id: string;
  isGodMode: boolean;
  agents: NexusAgentState[];
  startedAt: number;
  finishedAt?: number;
  synthesizing: boolean;
}

interface NexusStore {
  activeRun: NexusRun | null;
  /** Keep the last run around briefly after completion so the dashboard
   *  doesn't just vanish the instant agents finish. */
  startRun: (id: string, isGodMode: boolean, agents: Omit<NexusAgentState, 'status' | 'duration'>[]) => void;
  updateAgent: (runId: string, agentId: string, patch: Partial<NexusAgentState>) => void;
  setSynthesizing: (runId: string, v: boolean) => void;
  finishRun: (runId: string) => void;
  clearRun: () => void;
}

export const useNexusStore = create<NexusStore>((set, get) => ({
  activeRun: null,

  startRun: (id, isGodMode, agents) => {
    set({
      activeRun: {
        id,
        isGodMode,
        startedAt: Date.now(),
        synthesizing: false,
        agents: agents.map(a => ({ ...a, status: 'spawning' as const, duration: 0 })),
      },
    });
  },

  updateAgent: (runId, agentId, patch) => {
    const run = get().activeRun;
    if (!run || run.id !== runId) return;
    set({
      activeRun: {
        ...run,
        agents: run.agents.map(a => a.id === agentId ? { ...a, ...patch } : a),
      },
    });
  },

  setSynthesizing: (runId, v) => {
    const run = get().activeRun;
    if (!run || run.id !== runId) return;
    set({ activeRun: { ...run, synthesizing: v } });
  },

  finishRun: (runId) => {
    const run = get().activeRun;
    if (!run || run.id !== runId) return;
    set({ activeRun: { ...run, finishedAt: Date.now(), synthesizing: false } });
  },

  clearRun: () => set({ activeRun: null }),
}));
