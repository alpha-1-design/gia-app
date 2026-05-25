import GiaBrain from './GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getIntervalMs, formatNextRun, notifId } from '../utils/helpers';

class SchedulerService {
  private static instance: SchedulerService;
  private intervalId: NodeJS.Timeout | null = null;
  private handledIds = new Map<string, number>();  // id → timestamp
  private readonly TTL = 24 * 60 * 60 * 1000;       // 24h

  static getInstance() {
    if (!this.instance) this.instance = new SchedulerService();
    return this.instance;
  }

  private constructor() {}

  private isHandled(id: string): boolean {
    const ts = this.handledIds.get(id);
    if (!ts) return false;
    if (Date.now() - ts > this.TTL) {
      this.handledIds.delete(id);
      return false;
    }
    return true;
  }

  private async runTask(task: any) {
    if (this.isHandled(task.id)) return;
    this.handledIds.set(task.id, Date.now());

    const { updateTaskStatus, addNotification, activeSkillId, skills } = useGiaStore.getState();
    const { activeProvider, providers } = useProviderStore.getState();
    if (!providers[activeProvider]?.enabled) {
      updateTaskStatus(task.id, 'error', 'No provider');
      return;
    }
    updateTaskStatus(task.id, 'running');

    try {
      const skillName = skills.find(s => s.id === activeSkillId)?.name || 'General';
      const contextPrompt = `[Context: Skill=${skillName}, Provider=${activeProvider}, Model=${providers[activeProvider]?.model || 'unknown'}]\n\n${task.prompt}`;
      const res = await GiaBrain.generate({ prompt: contextPrompt, maxTokens: 800 });
      const isRecurring = task.interval && ['hourly', 'daily', 'weekly'].includes(task.interval);

      if (isRecurring) {
        const nextRun = Date.now() + getIntervalMs(task.interval);
        updateTaskStatus(task.id, 'pending', res.text, nextRun);

        await LocalNotifications.schedule({
          notifications: [{
            title: `⏰ ${task.title}`,
            body: `Next run ${formatNextRun(nextRun)}`,
            id: notifId(),
            schedule: { at: new Date(nextRun) },
            sound: 'default',
          }],
        });
      } else {
        updateTaskStatus(task.id, 'done', res.text);
      }

      addNotification(`✅ ${task.title.slice(0, 30)}`);

      try {
        await LocalNotifications.schedule({
          notifications: [{
            title: '✅ GIA Task Complete',
            body: res.text.slice(0, 120),
            id: notifId(),
            schedule: { at: new Date(Date.now() + 2000) },
            sound: 'default',
          }],
        });
      } catch {}
    } catch {
      updateTaskStatus(task.id, 'error', 'Task failed.');
    }
  }

  private async checkForDueTasks() {
    const { scheduledTasks } = useGiaStore.getState();
    if (scheduledTasks.length === 0) { this.stop(); return; }
    const now = Date.now();
    for (const task of scheduledTasks) {
      if (task.status === 'pending' && task.nextRun <= now) {
        await this.runTask(task);
      }
    }
  }

  public start() {
    if (this.intervalId) return;
    this.checkForDueTasks();
    this.intervalId = setInterval(() => this.checkForDueTasks(), 60000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export default SchedulerService.getInstance();
