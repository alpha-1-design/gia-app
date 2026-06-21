import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { autonomousAgent } from './AutonomousAgent';

export class ProactiveEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 30_000;
  private fastCheckIntervalMs = 10_000;
  private hangingTimeoutMs = 10 * 60 * 1000;

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

  restartWithFastInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.fastCheckIntervalMs);
    logger.log('[ProactiveEngine] Switched to fast interval (10s) for long-running mode');
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
          const stepAge = now - goal.updated;
          if (stepAge > this.hangingTimeoutMs) {
            logger.warn(`[ProactiveEngine] Step "${step.description}" hanging for ${Math.round(stepAge / 1000)}s — marking as failed`);
            store.updateStepStatus(plan.id, step.id, 'failed', `Timed out — step did not complete within ${this.hangingTimeoutMs / 60000} minutes`);
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

      await this.checkHangingSteps();

      const isLongRunning = useGiaStore.getState().longRunningMode;
      const maxConcurrent = isLongRunning ? 3 : 1;
      autonomousAgent.setMaxConcurrent(maxConcurrent);

      const idleTime = Date.now() - store.lastUserActivity;
      if (idleTime < store.config.idleThresholdMs) return;

      if (isLongRunning) {
        // In long-running mode, process more aggressively
        if (!autonomousAgent.isWorking()) {
          const processed = await autonomousAgent.processNextActionableStep();
          if (processed) {
            logger.log('[ProactiveEngine] Started next autonomous step');
          } else {
            // Log idle state periodically
            const activeGoals = store.getActiveGoals().filter(g => g.status === 'active').length;
            if (activeGoals > 0) {
              logger.log(`[ProactiveEngine] ${activeGoals} active goals, all steps processed or in progress`);
            }
          }
        }
      } else {
        // Normal mode: process one step at a time
        if (autonomousAgent.isWorking()) return;
        await autonomousAgent.processNextActionableStep();
      }
    } catch (e) {
      logger.error('[ProactiveEngine] Tick error:', e);
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

export const proactiveEngine = new ProactiveEngine();
