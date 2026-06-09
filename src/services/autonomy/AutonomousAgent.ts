import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import { goalPlanner } from './GoalPlanner';
import { reflectionEngine } from './ReflectionEngine';
import GiaBrain from '../GiaBrain';
import type { Goal, Plan, PlanStep } from '../../types/autonomy';

export class AutonomousAgent {
  private working = false;

  async createGoal(
    title: string,
    description: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  ): Promise<string> {
    const store = useAutonomyStore.getState();
    const goalId = store.addGoal(title, description, priority);

    const decomposition = await goalPlanner.decompose(title, description);
    store.createPlan(goalId, decomposition.steps);

    useMemoryStore.getState().addMemory({
      key: 'goal_set',
      value: `${title}: ${description}`,
      category: 'goal',
      tier: 'semantic',
      confidence: 0.9,
    });

    store.setActiveGoal(goalId);
    useGiaStore.getState().addNotification(`🎯 Goal created: ${title}`);

    logger.log(`[AutonomousAgent] Goal "${title}" created with ${decomposition.steps.length} steps`);
    return goalId;
  }

  async executeStep(goal: Goal, plan: Plan, step: PlanStep): Promise<void> {
    if (this.working) {
      logger.warn('[AutonomousAgent] Already executing a step, skipping');
      return;
    }
    this.working = true;

    try {
      const store = useAutonomyStore.getState();
      store.updateStepStatus(plan.id, step.id, 'in_progress');

      const prompt = `You are executing step ${plan.steps.indexOf(step) + 1} of ${plan.steps.length} for the goal "${goal.title}".

Step description: ${step.description}
Action needed: ${step.action}
Expected outcome: ${step.expectedOutcome}

Use the tools available to you to complete this step. Be thorough and resourceful. Return a detailed summary of what you did and what the result was.`;

      const res = await GiaBrain.generate({
        prompt,
        maxTokens: 2000,
        onThought: (thought) => {
          useGiaStore.getState().addNotification(`💭 ${thought.slice(0, 80)}...`);
        },
      });

      const reflection = await reflectionEngine.evaluate(
        goal.id, step.description, step.action, res.text
      );
      store.addReflection({ ...reflection, stepId: step.id });
      store.updateStepStatus(plan.id, step.id, reflection.outcome === 'success' ? 'completed' : 'failed', res.text);
      store.setActiveGoal(goal.id);

      const totalSteps = plan.steps.length;
      const completedSteps = plan.steps.filter(s =>
        s.id === step.id ? reflection.outcome === 'success' : s.status === 'completed'
      ).length;
      const progress = Math.round((completedSteps / totalSteps) * 100);
      store.setGoalProgress(goal.id, progress);

      if (progress >= 100) {
        store.setGoalStatus(goal.id, 'completed');
        useMemoryStore.getState().addMemory({
          key: 'goal_completed',
          value: goal.title,
          category: 'goal',
          tier: 'semantic',
          confidence: 0.95,
        });
        useGiaStore.getState().addNotification(`✅ Goal completed: ${goal.title}`);
      }
    } catch (e) {
      logger.error('[AutonomousAgent] Step execution failed:', e);
      const store = useAutonomyStore.getState();
      store.updateStepStatus(plan.id, step.id, 'failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      this.working = false;
    }
  }

  async processNextActionableStep(): Promise<boolean> {
    const store = useAutonomyStore.getState();
    const next = store.getNextActionableStep();
    if (!next) return false;

    if (!store.config.enabled) return false;

    await this.executeStep(next.goal, next.plan, next.step);
    return true;
  }

  isWorking(): boolean {
    return this.working;
  }

  getGoalSummary(goalId: string): string {
    const store = useAutonomyStore.getState();
    const goal = store.goals.find(g => g.id === goalId);
    if (!goal) return 'Goal not found';

    const plan = store.plans.find(p => p.id === goal.planId);
    const reflections = store.getGoalReflections(goalId);

    let summary = `Goal: ${goal.title} (${goal.status}, ${goal.progress}%)\nPriority: ${goal.priority}\n`;
    if (plan) {
      summary += `\nSteps:\n`;
      for (const step of plan.steps) {
        const stepNum = plan.steps.indexOf(step) + 1;
        const icon = step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : step.status === 'failed' ? '❌' : '⬜';
        summary += `${icon} ${stepNum}. ${step.description} [${step.status}]\n`;
      }
    }
    if (reflections.length > 0) {
      summary += `\nRecent reflections:\n`;
      for (const r of reflections.slice(0, 3)) {
        summary += `- ${r.outcome}: ${r.assessment}\n`;
      }
    }
    return summary;
  }
}

export const autonomousAgent = new AutonomousAgent();
