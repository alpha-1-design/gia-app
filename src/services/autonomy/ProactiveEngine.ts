import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { autonomousAgent } from './AutonomousAgent';

export class ProactiveEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 30_000;
  private fastCheckIntervalMs = 10_000;
  private hangingTimeoutMs = 10 * 60 * 1000;
  /** Fires when autonomy is re-enabled after we auto-stopped for disable. */
  private enabledUnsub: (() => void) | null = null;

  start(): void {
    if (this.intervalId) return;
    // Autonomy off → don't hold a CPU-waking interval that does nothing.
    // Park instead; the store subscription below revives us on re-enable.
    if (!useAutonomyStore.getState().config.enabled) {
      this.parkUntilEnabled();
      logger.log('[ProactiveEngine] Autonomy disabled — parked, waiting for re-enable');
      return;
    }
    logger.log('[ProactiveEngine] Starting background autonomy checks');

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.checkIntervalMs);

    this.tick();
  }

  /** Watch the autonomy flag so a parked engine revives without a restart. */
  private parkUntilEnabled(): void {
    if (this.enabledUnsub) return;
    this.enabledUnsub = useAutonomyStore.subscribe((s) => {
      if (s.config.enabled && this.intervalId === null) {
        if (this.enabledUnsub) { this.enabledUnsub(); this.enabledUnsub = null; }
        this.start();
      }
    });
  }

  stop(): void {
    if (this.enabledUnsub) { this.enabledUnsub(); this.enabledUnsub = null; }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restartWithFastInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.enabledUnsub) { this.enabledUnsub(); this.enabledUnsub = null; }
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
      if (!store.config.enabled) {
        // Nothing to do — stop burning a CPU wakeup every interval. The
        // parked subscription (or next start()) revives us on re-enable.
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
          this.parkUntilEnabled();
          logger.log('[ProactiveEngine] Autonomy turned off — engine parked');
        }
        return;
      }

      // Skip work entirely while the app is hidden in normal mode — the OS
      // throttles hidden timers anyway and autonomy steps want an awake
      // user-adjacent device unless long-running mode says otherwise.
      const isLongRunning = useGiaStore.getState().longRunningMode;
      if (!isLongRunning && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      await this.checkHangingSteps();

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
