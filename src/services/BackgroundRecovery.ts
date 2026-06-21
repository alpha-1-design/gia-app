import { useAutonomyStore } from '../store/useAutonomyStore';
import { useGiaStore } from '../store/useGiaStore';
import { logger } from '../utils/logger';

export class BackgroundRecovery {
  private recovered = false;

  async recover(): Promise<void> {
    if (this.recovered) return;
    this.recovered = true;

    const store = useAutonomyStore.getState();
    const activeSteps = store.getActiveSteps();

    if (activeSteps.length === 0) return;

    const interrupted = activeSteps.filter(s => s.step.status === 'in_progress');
    if (interrupted.length === 0) return;

    logger.log(`[BackgroundRecovery] Found ${interrupted.length} interrupted step(s)`);

    for (const { goal, plan, step } of interrupted) {
      store.updateStepStatus(plan.id, step.id, 'pending',
        'Interrupted — will retry on next cycle');
      useGiaStore.getState().addNotification(
        `🔄 ${goal.title}: step "${step.description.slice(0, 50)}" was interrupted. Will resume.`);

      store.setActiveGoal(goal.id);
    }

    const pending = activeSteps.filter(s => s.step.status === 'pending');
    if (pending.length > 0) {
      useGiaStore.getState().addNotification(
        `🔄 Recovered ${pending.length} pending task(s). GIA will continue working.`);
    }
  }

  hasRecovered(): boolean {
    return this.recovered;
  }
}

export const backgroundRecovery = new BackgroundRecovery();
