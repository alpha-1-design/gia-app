import { logger } from '../utils/logger';
import GiaBrain from './GiaBrain';
import { useGiaStore, ScheduledTask } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getIntervalMs, formatNextRun, notifId, isNativePlatform } from '../utils/helpers';
import socialManager from './social/SocialManager';
import messagingBridge from './MessagingBridge';

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

  private async runTask(task: ScheduledTask) {
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
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30000);
      const skillName = skills.find(s => s.id === activeSkillId)?.name || 'General';
      const contextPrompt = `[Context: Skill=${skillName}, Provider=${activeProvider}, Model=${providers[activeProvider]?.model || 'unknown'}]\n\n${task.prompt}`;
      const res = await GiaBrain.generate({ prompt: contextPrompt, maxTokens: 800, signal: ctrl.signal });
      clearTimeout(timeout);
      const isRecurring = task.interval && ['hourly', 'daily', 'weekly'].includes(task.interval);

      if (isRecurring) {
        const nextRun = Date.now() + getIntervalMs(task.interval);
        updateTaskStatus(task.id, 'pending', res.text, nextRun);

        if (isNativePlatform()) {
          try {
            await LocalNotifications.schedule({
              notifications: [{
                title: `⏰ ${task.title}`,
                body: `Next run ${formatNextRun(nextRun)}`,
                id: notifId(),
                schedule: { at: new Date(nextRun) },
                sound: 'default',
              }],
            });
          } catch { /* ignore notification errors on web/unsupported */ }
        }
      } else {
        updateTaskStatus(task.id, 'done', res.text);
      }

      addNotification(`✅ ${task.title.slice(0, 30)}`);

      // Send result via messaging if channel configured
      if (task.channel && messagingBridge.isConnected(task.channel)) {
        messagingBridge.sendMessage({
          channel: task.channel,
          to: '',
          text: res.text,
        }).catch(e => logger.warn('[SchedulerService] Messaging delivery failed:', e));
      }

      if (isNativePlatform()) {
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
        } catch { /* ignore notification errors on web/unsupported */ }
      }
    } catch {
      updateTaskStatus(task.id, 'error', 'Task failed.');
    }
  }

  private async checkForDueTasks() {
    const { scheduledTasks } = useGiaStore.getState();
    const hasTasks = scheduledTasks.length > 0;
    const now = Date.now();

    // Run due brain-prompt tasks
    if (hasTasks) {
      for (const task of scheduledTasks) {
        if (task.status === 'pending' && task.nextRun <= now) {
          await this.runTask(task);
        }
      }
    }

    // Auto-publish due scheduled social posts
    try {
      const posts = socialManager.getPosts();
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        if (post.status === 'scheduled' && post.scheduledAt && post.scheduledAt <= now) {
          logger.log(`[SchedulerService] Publishing scheduled post #${i} to ${post.platform}`);
          try {
            await socialManager.publishPost(i);
            useGiaStore.getState().addNotification(`📢 Published scheduled post to ${post.platform}`);
          } catch (e) {
            logger.error(`[SchedulerService] Failed to publish post #${i}:`, e);
            useGiaStore.getState().addNotification(`❌ Scheduled post to ${post.platform} failed`);
          }
        }
      }
    } catch (e) {
      logger.error('[SchedulerService] Social post check failed:', e);
    }

    if (!hasTasks) { this.stop(); return; }
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
