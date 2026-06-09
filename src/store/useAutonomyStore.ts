import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import type {
  Goal, Plan, PlanStep, Reflection, AutonomousState,
  GoalStatus, GoalPriority, StepStatus,
} from '../types/autonomy';

export type { Goal, Plan, PlanStep, Reflection };

interface AutonomyStore {
  goals: Goal[];
  plans: Plan[];
  reflections: Reflection[];
  config: AutonomousState;
  lastUserActivity: number;
  activeGoalId: string | null;

  addGoal: (title: string, description: string, priority?: GoalPriority, source?: Goal['source']) => string;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  setGoalStatus: (id: string, status: GoalStatus) => void;
  setGoalProgress: (id: string, progress: number) => void;
  addSubGoal: (parentId: string, childId: string) => void;

  createPlan: (goalId: string, steps: Omit<PlanStep, 'id'>[]) => string;
  updateStepStatus: (planId: string, stepId: string, status: StepStatus, result?: string) => void;
  getActiveSteps: () => { goal: Goal; plan: Plan; step: PlanStep }[];

  addReflection: (reflection: Omit<Reflection, 'id' | 'timestamp'>) => string;
  getGoalReflections: (goalId: string) => Reflection[];

  getActiveGoals: () => Goal[];
  getNextActionableStep: () => { goal: Goal; plan: Plan; step: PlanStep } | null;

  setConfig: (updates: Partial<AutonomousState>) => void;
  setLastUserActivity: () => void;
  setActiveGoal: (id: string | null) => void;
}

export const useAutonomyStore = create<AutonomyStore>()(
  persist(
    (set, get) => ({
      goals: [],
      plans: [],
      reflections: [],
      config: {
        enabled: false,
        proactivenessLevel: 0.5,
        maxConcurrentGoals: 3,
        reflectionRequired: true,
        idleThresholdMs: 5 * 60 * 1000,
      },
      lastUserActivity: Date.now(),
      activeGoalId: null,

      addGoal: (title, description, priority = 'medium', source = 'user') => {
        const id = genId();
        const goal: Goal = {
          id,
          title,
          description,
          priority,
          status: 'active',
          created: Date.now(),
          updated: Date.now(),
          progress: 0,
          subGoalIds: [],
          reflectionIds: [],
          tags: [],
          source,
        };
        set(s => ({ goals: [...s.goals, goal] }));
        return id;
      },

      updateGoal: (id, updates) => {
        set(s => ({
          goals: s.goals.map(g => g.id === id ? { ...g, ...updates, updated: Date.now() } : g),
        }));
      },

      removeGoal: (id) => {
        set(s => ({
          goals: s.goals.filter(g => g.id !== id),
          plans: s.plans.filter(p => p.goalId !== id),
          reflections: s.reflections.filter(r => r.goalId !== id),
        }));
      },

      setGoalStatus: (id, status) => {
        const goal = get().goals.find(g => g.id === id);
        if (goal) {
          get().updateGoal(id, { status, updated: Date.now() });
        }
      },

      setGoalProgress: (id, progress) => {
        get().updateGoal(id, { progress });
      },

      addSubGoal: (parentId, childId) => {
        set(s => ({
          goals: s.goals.map(g =>
            g.id === parentId
              ? { ...g, subGoalIds: [...g.subGoalIds, childId], updated: Date.now() }
              : g
          ),
        }));
      },

      createPlan: (goalId, steps) => {
        const id = genId();
        const plan: Plan = {
          id,
          goalId,
          steps: steps.map(s => ({ ...s, id: genId() })),
          status: 'active',
          created: Date.now(),
          updated: Date.now(),
        };
        set(s => {
          const updatedPlans = s.plans.filter(p => p.goalId !== goalId);
          return {
            plans: [...updatedPlans, plan],
            goals: s.goals.map(g => g.id === goalId ? { ...g, planId: id, updated: Date.now() } : g),
          };
        });
        return id;
      },

      updateStepStatus: (planId, stepId, status, result) => {
        set(s => ({
          plans: s.plans.map(p =>
            p.id === planId
              ? {
                  ...p,
                  updated: Date.now(),
                  steps: p.steps.map(st =>
                    st.id === stepId ? { ...st, status, result: result ?? st.result } : st
                  ),
                  status: status === 'completed' && p.steps.every(s => s.id === stepId || s.status === 'completed' || s.status === 'skipped')
                    ? 'completed'
                    : status === 'failed'
                    ? 'failed'
                    : p.status,
                }
              : p
          ),
        }));
      },

      getActiveSteps: () => {
        const { goals, plans } = get();
        const results: { goal: Goal; plan: Plan; step: PlanStep }[] = [];
        for (const goal of goals) {
          if (goal.status !== 'active') continue;
          const plan = plans.find(p => p.id === goal.planId);
          if (!plan || plan.status !== 'active') continue;
          const step = plan.steps.find(s => s.status === 'in_progress' || s.status === 'pending');
          if (step) results.push({ goal, plan, step });
        }
        return results;
      },

      addReflection: (reflection) => {
        const id = genId();
        const ref: Reflection = {
          ...reflection,
          id,
          timestamp: Date.now(),
        };
        set(s => ({
          reflections: [...s.reflections, ref],
          goals: s.goals.map(g =>
            g.id === ref.goalId
              ? { ...g, reflectionIds: [...g.reflectionIds, id], updated: Date.now() }
              : g
          ),
        }));
        return id;
      },

      getGoalReflections: (goalId) => {
        return get().reflections.filter(r => r.goalId === goalId)
          .sort((a, b) => b.timestamp - a.timestamp);
      },

      getActiveGoals: () => {
        return get().goals.filter(g => g.status === 'active')
          .sort((a, b) => {
            const prio = { critical: 0, high: 1, medium: 2, low: 3 };
            return (prio[a.priority] ?? 99) - (prio[b.priority] ?? 99);
          });
      },

      getNextActionableStep: () => {
        const { goals, plans } = get();
        for (const goal of goals) {
          if (goal.status !== 'active') continue;
          const plan = plans.find(p => p.id === goal.planId);
          if (!plan || plan.status !== 'active') continue;
          const step = plan.steps.find(s => s.status === 'pending');
          if (step) return { goal, plan, step };
        }
        return null;
      },

      setConfig: (updates) => {
        set(s => ({ config: { ...s.config, ...updates } }));
      },

      setLastUserActivity: () => {
        set({ lastUserActivity: Date.now() });
      },

      setActiveGoal: (id) => {
        set({ activeGoalId: id });
      },
    }),
    {
      name: 'gia-autonomy',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        goals: state.goals,
        plans: state.plans,
        reflections: state.reflections,
        config: state.config,
      }),
    }
  )
);
