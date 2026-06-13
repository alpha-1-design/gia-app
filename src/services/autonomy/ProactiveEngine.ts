import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { autonomousAgent } from './AutonomousAgent';

export class ProactiveEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 30_000;
  private hangingTimeoutMs = 5 * 60 * 1000;

  start(): void {
    if (this.intervalId) return;
    logger.log('[ProactiveEngine] Starting background autonomy checks');

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.checkIntervalMs);

    this.tick();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkHangingSteps(): Promise<void> {
    const store = useAutonomyStore.getState();
    const now = Date.now();
    for (const plan of store.plans) {
      if (plan.status !== 'active') continue;
      for (const step of plan.steps) {
        if (step.status === 'in_progress') {
          const goal = store.goals.find(g => g.id === plan.goalId);
          if (!goal) continue;
          const stepIdx = plan.steps.indexOf(step);
          const stepAge = now - goal.updated;
          if (stepAge > this.hangingTimeoutMs) {
            logger.warn(`[ProactiveEngine] Step "${step.description}" hanging for ${Math.round(stepAge / 1000)}s — marking as failed`);
            store.updateStepStatus(plan.id, step.id, 'failed', 'Timed out — step did not complete within 5 minutes');
            useGiaStore.getState().addNotification(`⚠️ Goal step timed out: "${step.description.slice(0, 60)}"`);
          }
        }
      }
    }
  }

  private async tick(): Promise<void> {
    try {
      const store = useAutonomyStore.getState();

      if (!store.config.enabled) return;

      // Check for hanging steps first
      await this.checkHangingSteps();

      if (autonomousAgent.isWorking()) return;

      const idleTime = Date.now() - store.lastUserActivity;
      if (idleTime < store.config.idleThresholdMs) return;

      await autonomousAgent.processNextActionableStep();
    } catch (e) {
      logger.error('[ProactiveEngine] Tick error:', e);
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

export const proactiveEngine = new ProactiveEngine();
