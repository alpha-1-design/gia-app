import { describe, it, expect, beforeEach, vi } from 'vitest';

let idCounter = 0;

vi.mock('../idb-storage', () => {
  const store = new Map<string, string>();
  return {
    idbStorage: {
      getItem: vi.fn(async (name: string) => store.get(name) ?? null),
      setItem: vi.fn(async (name: string, value: string) => { store.set(name, value); }),
      removeItem: vi.fn(async (name: string) => { store.delete(name); }),
    },
  };
});

vi.mock('../../utils/id', () => ({
  genId: vi.fn(() => `autonomy-id-${++idCounter}`),
}));

const { useAutonomyStore } = await import('../useAutonomyStore');

describe('useAutonomyStore', () => {
  beforeEach(() => {
    idCounter = 0;
    useAutonomyStore.setState({
      goals: [],
      plans: [],
      reflections: [],
      config: {
        enabled: false,
        proactivenessLevel: 0.5,
        maxConcurrentGoals: 3,
        reflectionRequired: true,
        idleThresholdMs: 300000,
      },
      lastUserActivity: Date.now(),
      activeGoalId: null,
    });
  });

  describe('addGoal', () => {
    it('adds a goal with default priority and source', () => {
      const id = useAutonomyStore.getState().addGoal('Test Goal', 'A test goal');
      const goal = useAutonomyStore.getState().goals[0];
      expect(goal.id).toBe(id);
      expect(goal.title).toBe('Test Goal');
      expect(goal.description).toBe('A test goal');
      expect(goal.priority).toBe('medium');
      expect(goal.status).toBe('active');
      expect(goal.source).toBe('user');
      expect(goal.progress).toBe(0);
      expect(goal.subGoalIds).toEqual([]);
      expect(goal.reflectionIds).toEqual([]);
      expect(goal.tags).toEqual([]);
    });

    it('adds a goal with custom priority and source', () => {
      useAutonomyStore.getState().addGoal('Critical', 'Urgent', 'critical', 'autonomous');
      const goal = useAutonomyStore.getState().goals[0];
      expect(goal.priority).toBe('critical');
      expect(goal.source).toBe('autonomous');
    });

    it('assigns incremental IDs', () => {
      useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().addGoal('G2', '');
      const goals = useAutonomyStore.getState().goals;
      expect(goals[0].id).toBe('autonomy-id-1');
      expect(goals[1].id).toBe('autonomy-id-2');
    });
  });

  describe('updateGoal', () => {
    it('updates goal fields and sets updated timestamp', () => {
      const id = useAutonomyStore.getState().addGoal('G1', '');
      const before = useAutonomyStore.getState().goals[0].updated;
      useAutonomyStore.getState().updateGoal(id, { title: 'Updated', priority: 'high' });
      const goal = useAutonomyStore.getState().goals[0];
      expect(goal.title).toBe('Updated');
      expect(goal.priority).toBe('high');
      expect(goal.updated).toBeGreaterThanOrEqual(before);
    });

    it('does nothing for unknown id', () => {
      useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().updateGoal('nonexistent', { title: 'Nope' });
      expect(useAutonomyStore.getState().goals).toHaveLength(1);
    });
  });

  describe('removeGoal', () => {
    it('removes goal and associated plans and reflections', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const pid = useAutonomyStore.getState().createPlan(gid, [{ description: 'Step 1', action: 'do', expectedOutcome: 'done', status: 'pending' }]);
      useAutonomyStore.getState().addReflection({ goalId: gid, outcome: 'success', assessment: 'good', lessonsLearned: [], confidence: 1 });
      useAutonomyStore.getState().removeGoal(gid);
      expect(useAutonomyStore.getState().goals).toHaveLength(0);
      expect(useAutonomyStore.getState().plans).toHaveLength(0);
      expect(useAutonomyStore.getState().reflections).toHaveLength(0);
    });
  });

  describe('setGoalStatus and setGoalProgress', () => {
    it('updates status and sets updated timestamp', () => {
      const id = useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().setGoalStatus(id, 'completed');
      expect(useAutonomyStore.getState().goals[0].status).toBe('completed');
    });

    it('updates progress', () => {
      const id = useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().setGoalProgress(id, 50);
      expect(useAutonomyStore.getState().goals[0].progress).toBe(50);
    });
  });

  describe('addSubGoal', () => {
    it('adds subGoalId to parent', () => {
      const p = useAutonomyStore.getState().addGoal('Parent', '');
      const c = useAutonomyStore.getState().addGoal('Child', '');
      useAutonomyStore.getState().addSubGoal(p, c);
      expect(useAutonomyStore.getState().goals.find(g => g.id === p)?.subGoalIds).toContain(c);
    });
  });

  describe('createPlan', () => {
    it('creates a plan linked to a goal', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const pid = useAutonomyStore.getState().createPlan(gid, [
        { description: 'Step 1', action: 'do', expectedOutcome: 'done', status: 'pending' },
        { description: 'Step 2', action: 'do', expectedOutcome: 'done', status: 'pending' },
      ]);
      const plan = useAutonomyStore.getState().plans[0];
      expect(plan.id).toBe(pid);
      expect(plan.goalId).toBe(gid);
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].status).toBe('pending');
      expect(plan.status).toBe('active');
      expect(useAutonomyStore.getState().goals[0].planId).toBe(pid);
    });

    it('replaces existing plan for the same goal', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().createPlan(gid, [{ description: 'Old', action: '', expectedOutcome: '', status: 'pending' }]);
      useAutonomyStore.getState().createPlan(gid, [{ description: 'New', action: '', expectedOutcome: '', status: 'pending' }]);
      expect(useAutonomyStore.getState().plans).toHaveLength(1);
      expect(useAutonomyStore.getState().plans[0].steps[0].description).toBe('New');
    });
  });

  describe('updateStepStatus', () => {
    it('completes a step and completes the plan when all steps done', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const pid = useAutonomyStore.getState().createPlan(gid, [
        { description: 'S1', action: '', expectedOutcome: '', status: 'pending' },
        { description: 'S2', action: '', expectedOutcome: '', status: 'completed' },
      ]);
      useAutonomyStore.getState().updateStepStatus(pid, useAutonomyStore.getState().plans[0].steps[0].id, 'completed');
      expect(useAutonomyStore.getState().plans[0].status).toBe('completed');
    });

    it('marks plan as failed when a step fails', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const pid = useAutonomyStore.getState().createPlan(gid, [
        { description: 'S1', action: '', expectedOutcome: '', status: 'pending' },
      ]);
      useAutonomyStore.getState().updateStepStatus(pid, useAutonomyStore.getState().plans[0].steps[0].id, 'failed');
      expect(useAutonomyStore.getState().plans[0].status).toBe('failed');
    });

    it('stores result on step', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const pid = useAutonomyStore.getState().createPlan(gid, [
        { description: 'S1', action: '', expectedOutcome: '', status: 'pending' },
      ]);
      useAutonomyStore.getState().updateStepStatus(pid, useAutonomyStore.getState().plans[0].steps[0].id, 'completed', 'done!');
      expect(useAutonomyStore.getState().plans[0].steps[0].result).toBe('done!');
    });
  });

  describe('getActiveSteps', () => {
    it('returns steps that are pending or in_progress for active goals', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().createPlan(gid, [
        { description: 'S1', action: '', expectedOutcome: '', status: 'pending' },
        { description: 'S2', action: '', expectedOutcome: '', status: 'completed' },
      ]);
      const active = useAutonomyStore.getState().getActiveSteps();
      expect(active).toHaveLength(1);
      expect(active[0].step.description).toBe('S1');
    });

    it('excludes non-active goals', () => {
      const gid1 = useAutonomyStore.getState().addGoal('Active', '');
      const gid2 = useAutonomyStore.getState().addGoal('Completed', '');
      useAutonomyStore.getState().setGoalStatus(gid2, 'completed');
      useAutonomyStore.getState().createPlan(gid1, [{ description: 'S1', action: '', expectedOutcome: '', status: 'pending' }]);
      useAutonomyStore.getState().createPlan(gid2, [{ description: 'S2', action: '', expectedOutcome: '', status: 'pending' }]);
      expect(useAutonomyStore.getState().getActiveSteps()).toHaveLength(1);
    });
  });

  describe('addReflection and getGoalReflections', () => {
    it('adds reflection and links it to the goal', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const rid = useAutonomyStore.getState().addReflection({
        goalId: gid, outcome: 'success', assessment: 'Great', lessonsLearned: ['learned a lot'], confidence: 0.9,
      });
      const ref = useAutonomyStore.getState().reflections[0];
      expect(ref.id).toBe(rid);
      expect(ref.goalId).toBe(gid);
      expect(useAutonomyStore.getState().goals[0].reflectionIds).toContain(rid);
    });

    it('returns reflections sorted by timestamp descending', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      const r1 = useAutonomyStore.getState().addReflection({ goalId: gid, outcome: 'success', assessment: 'old', lessonsLearned: [], confidence: 0.5 });
      const oldTime = useAutonomyStore.getState().reflections.find(r => r.id === r1)!.timestamp;
      // Force a later timestamp by modifying directly
      useAutonomyStore.setState({
        reflections: useAutonomyStore.getState().reflections.map(r =>
          r.id === r1 ? { ...r, timestamp: oldTime - 1000 } : r
        ),
      });
      useAutonomyStore.getState().addReflection({ goalId: gid, outcome: 'failure', assessment: 'new', lessonsLearned: [], confidence: 0.3 });
      const sorted = useAutonomyStore.getState().getGoalReflections(gid);
      expect(sorted[0].assessment).toBe('new');
      expect(sorted[1].assessment).toBe('old');
    });
  });

  describe('getActiveGoals', () => {
    it('sorts by priority: critical > high > medium > low', () => {
      useAutonomyStore.getState().addGoal('Low', '', 'low');
      useAutonomyStore.getState().addGoal('High', '', 'high');
      useAutonomyStore.getState().addGoal('Medium', '', 'medium');
      useAutonomyStore.getState().addGoal('Critical', '', 'critical');
      const active = useAutonomyStore.getState().getActiveGoals();
      expect(active[0].title).toBe('Critical');
      expect(active[1].title).toBe('High');
      expect(active[2].title).toBe('Medium');
      expect(active[3].title).toBe('Low');
    });

    it('excludes non-active statuses', () => {
      const id = useAutonomyStore.getState().addGoal('Done', '', 'high');
      useAutonomyStore.getState().setGoalStatus(id, 'completed');
      expect(useAutonomyStore.getState().getActiveGoals()).toHaveLength(0);
    });
  });

  describe('getNextActionableStep', () => {
    it('returns first pending step from active goals', () => {
      const gid = useAutonomyStore.getState().addGoal('G1', '');
      useAutonomyStore.getState().createPlan(gid, [
        { description: 'S1', action: '', expectedOutcome: '', status: 'in_progress' },
        { description: 'S2', action: '', expectedOutcome: '', status: 'pending' },
      ]);
      const next = useAutonomyStore.getState().getNextActionableStep();
      expect(next).not.toBeNull();
      expect(next!.step.description).toBe('S2');
    });

    it('returns null when no pending steps', () => {
      expect(useAutonomyStore.getState().getNextActionableStep()).toBeNull();
    });
  });

  describe('setConfig', () => {
    it('merges config updates', () => {
      useAutonomyStore.getState().setConfig({ proactivenessLevel: 0.9, enabled: true });
      expect(useAutonomyStore.getState().config.proactivenessLevel).toBe(0.9);
      expect(useAutonomyStore.getState().config.enabled).toBe(true);
      expect(useAutonomyStore.getState().config.maxConcurrentGoals).toBe(3);
    });
  });

  describe('setLastUserActivity and setActiveGoal', () => {
    it('updates lastUserActivity timestamp', () => {
      useAutonomyStore.getState().setLastUserActivity();
      expect(useAutonomyStore.getState().lastUserActivity).toBeGreaterThan(0);
    });

    it('sets active goal id', () => {
      useAutonomyStore.getState().setActiveGoal('goal-1');
      expect(useAutonomyStore.getState().activeGoalId).toBe('goal-1');
    });
  });
});
