import { logger } from '../../utils/logger';
import { useAutonomyStore } from '../../store/useAutonomyStore';
import { autonomousAgent } from './AutonomousAgent';

export class ProactiveEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs = 60_000;

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

  private async tick(): Promise<void> {
    try {
      const store = useAutonomyStore.getState();

      if (!store.config.enabled) return;
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
