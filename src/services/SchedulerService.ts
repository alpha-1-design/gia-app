import GiaBrain from './GiaBrain';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { LocalNotifications } from '@capacitor/local-notifications';

const getIntervalMs = (interval: string) =>
  interval === 'hourly' ? 3600000 : interval === 'daily' ? 86400000 : 604800000;

const formatNextRun = (ts: number) => {
  const diff = ts - Date.now();
  if (diff <= 0) return 'now';
  if (diff < 3600000) return `in ${Math.ceil(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.ceil(diff / 3600000)}h`;
  return `in ${Math.ceil(diff / 86400000)}d`;
};

const notifId = () => (Date.now() % 100000) + Math.floor(Math.random() * 1000);

class SchedulerService {
  private static instance: SchedulerService;
  private intervalId: NodeJS.Timeout | null = null;
  private handledIds = new Set<string>();

  static getInstance() {
    if (!this.instance) this.instance = new SchedulerService();
    return this.instance;
  }

  private constructor() {
    this.start();
  }

  private async runTask(task: any) {
    if (this.handledIds.has(task.id)) return;
    this.handledIds.add(task.id);

    const { updateTaskStatus, addNotification, activeSkillId, skills } = useGiaStore.getState();
    const { activeProvider, providers } = useProviderStore.getState();
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
    } catch (e) {
      updateTaskStatus(task.id, 'error', 'Task failed.');
      useGiaStore.getState().addNotification(`❌ ${task.title.slice(0, 30)}`);
    }
  }

  private async checkForDueTasks() {
    const tasks = useGiaStore.getState().scheduledTasks;
    const now = Date.now();
    for (const task of tasks) {
      if (task.status === 'pending' && task.nextRun <= now) {
        await this.runTask(task);
      }
    }
    // Clear handled IDs periodically to allow recurring tasks to run again
    // Since recurring tasks are updated to 'pending' with a new nextRun,
    // we only need to track handledIds within one check cycle or
    // manage them based on timestamp.
    // For simplicity in this agentic loop, we clear handledIds after a full sweep.
    this.handledIds.clear();
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
