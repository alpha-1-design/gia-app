import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import { goalPlanner } from './GoalPlanner';
import { reflectionEngine } from './ReflectionEngine';
import GiaBrain from '../GiaBrain';
import messagingBridge from '../MessagingBridge';
import type { Goal, Plan, PlanStep } from '../../types/autonomy';

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export class AutonomousAgent {
  private activeSteps: Map<string, { startTime: number; heartbeat?: ReturnType<typeof setInterval> }> = new Map();
  private maxConcurrent = 2;

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

    if (store.config.enabled && this.getActiveCount() < this.maxConcurrent) {
      const next = store.getNextActionableStep();
      if (next) {
        logger.log(`[AutonomousAgent] Auto-starting first step for "${title}"`);
        this.executeStep(next.goal, next.plan, next.step);
      }
    }

    return goalId;
  }

  async executeStep(goal: Goal, plan: Plan, step: PlanStep): Promise<void> {
    if (this.getActiveCount() >= this.maxConcurrent) {
      logger.warn('[AutonomousAgent] Max concurrent steps reached, queuing');
      return;
    }

    const stepKey = `${plan.id}-${step.id}`;
    if (this.activeSteps.has(stepKey)) return;

    const record: { startTime: number; heartbeat?: ReturnType<typeof setInterval> } = { startTime: Date.now() };
    this.activeSteps.set(stepKey, record);

    try {
      const store = useAutonomyStore.getState();
      store.updateStepStatus(plan.id, step.id, 'in_progress');

      // Heartbeat — log every 60s that the step is still running
      record.heartbeat = setInterval(() => {
        const elapsed = Date.now() - record.startTime;
        logger.log(`[AutonomousAgent] Step "${step.description.slice(0, 40)}" still running (${formatDuration(elapsed)})`);
        store.setGoalProgress(goal.id, Math.min(99, Math.round((elapsed / 600000) * 100)));
      }, 60000);

      const stepNum = plan.steps.indexOf(step) + 1;
      const prompt = `You are executing step ${stepNum} of ${plan.steps.length} for the goal "${goal.title}".

Step description: ${step.description}
Action needed: ${step.action}
Expected outcome: ${step.expectedOutcome}

This step may take a long time. Work through it methodically. Use the tools available to you.
Report progress and results. If you need to wait (e.g. for data processing), do so and report when done.

Return a detailed summary of what you did and what the result was.`;

      const res = await GiaBrain.generate({
        prompt,
        maxTokens: 4000,
        onThought: (thought) => {
          useGiaStore.getState().addNotification(`💭 ${thought.slice(0, 80)}...`);
        },
      });

      const elapsed = Date.now() - record.startTime;
      logger.log(`[AutonomousAgent] Step completed in ${formatDuration(elapsed)}`);

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

      // Notify on completion via messaging if configured
      const notifyChannels = messagingBridge.getChannels().filter(c => c.connected);

      if (progress >= 100) {
        store.setGoalStatus(goal.id, 'completed');
        useMemoryStore.getState().addMemory({
          key: 'goal_completed',
          value: goal.title,
          category: 'goal',
          tier: 'semantic',
          confidence: 0.95,
        });
        const msg = `✅ Goal completed: ${goal.title}`;
        useGiaStore.getState().addNotification(msg);
        for (const ch of notifyChannels) {
          messagingBridge.sendMessage({ channel: ch.type, to: '', text: `✅ *Goal Completed!*\n\n${goal.title}\n\n${goal.description.slice(0, 200)}` });
        }
      } else if (reflection.outcome === 'failure') {
        const msg = `⚠️ Step failed for "${goal.title}": ${step.description.slice(0, 60)}`;
        useGiaStore.getState().addNotification(msg);
        for (const ch of notifyChannels) {
          messagingBridge.sendMessage({ channel: ch.type, to: '', text: `⚠️ *Step Failed*\n\nGoal: ${goal.title}\nStep: ${step.description.slice(0, 100)}\n\nCheck on me when you can.` });
        }
      }

      // Auto-continue to next step if available
      if (progress < 100 && reflection.outcome === 'success') {
        const next = store.getNextActionableStep();
        if (next && store.config.enabled) {
          logger.log(`[AutonomousAgent] Auto-continuing to next step for "${goal.title}"`);
          this.executeStep(next.goal, next.plan, next.step);
        }
      }
    } catch (e) {
      logger.error('[AutonomousAgent] Step execution failed:', e);
      const store = useAutonomyStore.getState();
      store.updateStepStatus(plan.id, step.id, 'failed', e instanceof Error ? e.message : 'Unknown error');
      for (const ch of messagingBridge.getChannels().filter(c => c.connected)) {
        messagingBridge.sendMessage({ channel: ch.type, to: '', text: `❌ *Error on step*\n\nGoal: ${goal.title}\nError: ${e instanceof Error ? e.message.slice(0, 200) : 'Unknown error'}` });
      }
    } finally {
      if (record.heartbeat) clearInterval(record.heartbeat);
      this.activeSteps.delete(stepKey);
    }
  }

  async processNextActionableStep(): Promise<boolean> {
    const store = useAutonomyStore.getState();
    if (!store.config.enabled) return false;

    const next = store.getNextActionableStep();
    if (!next) return false;

    if (this.getActiveCount() >= this.maxConcurrent) return false;

    this.executeStep(next.goal, next.plan, next.step).catch(e => {
      logger.error('[AutonomousAgent] processNextActionableStep error:', e);
    });
    return true;
  }

  getActiveCount(): number {
    return this.activeSteps.size;
  }

  isWorking(): boolean {
    return this.activeSteps.size > 0;
  }

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, Math.min(5, n));
  }

  getGoalSummary(goalId: string): string {
    const store = useAutonomyStore.getState();
    const goal = store.goals.find(g => g.id === goalId);
    if (!goal) return 'Goal not found';

    const plan = store.plans.find(p => p.goalId === goalId);
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
