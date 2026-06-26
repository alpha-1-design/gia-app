import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export type TriggerType =
  | 'time' | 'cron'
  | 'notification' | 'message'
  | 'location' | 'calendar'
  | 'entity_mentioned' | 'mood_change'
  | 'goal_status' | 'app_launched'
  | 'file_created' | 'custom';

export type ActionType =
  | 'run_tool' | 'send_message'
  | 'run_prompt' | 'set_reminder'
  | 'create_goal' | 'call_webhook'
  | 'toggle_feature' | 'notify'
  | 'run_script' | 'custom';

export interface TriggerConfig {
  type: TriggerType;
  params: Record<string, string>;
  cooldownMs: number;
}

export interface ActionConfig {
  type: ActionType;
  params: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: TriggerConfig;
  actions: ActionConfig[];
  created: number;
  lastTriggered: number | null;
  triggerCount: number;
  maxTriggersPerDay: number;
}

interface AutomationState {
  rules: AutomationRule[];
  addRule: (rule: Omit<AutomationRule, 'id' | 'created' | 'lastTriggered' | 'triggerCount'>) => void;
  updateRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  recordTrigger: (id: string) => void;
  getEnabledRules: () => AutomationRule[];
  getRulesByTrigger: (type: TriggerType) => AutomationRule[];
  clear: () => void;
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      rules: [],

      addRule: (rule) =>
        set((s) => ({
          rules: [
            ...s.rules,
            {
              ...rule,
              id: genId(),
              created: Date.now(),
              lastTriggered: null,
              triggerCount: 0,
            },
          ],
        })),

      updateRule: (id, updates) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

      toggleRule: (id) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
        })),

      recordTrigger: (id) =>
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id
              ? {
                  ...r,
                  lastTriggered: Date.now(),
                  triggerCount: r.triggerCount + 1,
                }
              : r
          ),
        })),

      getEnabledRules: () => get().rules.filter((r) => r.enabled),
      getRulesByTrigger: (type) => get().rules.filter((r) => r.trigger.type === type),
      clear: () => set({ rules: [] }),
    }),
    {
      name: 'gia-automation-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ rules: s.rules }),
    }
  )
);
