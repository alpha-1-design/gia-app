import { logger } from '../utils/logger';
import { useAutomationStore, type AutomationRule } from '../store/useAutomationStore';
import { useMemoryStore } from '../store/useMemoryStore';

type CronPart = '*' | number;
interface CronExpr {
  minute: CronPart[];
  hour: CronPart[];
  dayOfMonth: CronPart[];
  month: CronPart[];
  dayOfWeek: CronPart[];
}

function parseCron(expr: string): CronExpr {
  const parts = expr.split(/\s+/);
  if (parts.length !== 5) throw new Error('Invalid cron expression');
  const parsePart = (p: string): CronPart[] => {
    if (p === '*') return ['*'];
    return p.split(',').map(Number);
  };
  return {
    minute: parsePart(parts[0]),
    hour: parsePart(parts[1]),
    dayOfMonth: parsePart(parts[2]),
    month: parsePart(parts[3]),
    dayOfWeek: parsePart(parts[4]),
  };
}

function matchesCron(cron: CronExpr, date: Date): boolean {
  const match = (part: CronPart[], value: number): boolean =>
    part.includes('*') || part.includes(value);
  return (
    match(cron.minute, date.getMinutes()) &&
    match(cron.hour, date.getHours()) &&
    match(cron.dayOfMonth, date.getDate()) &&
    match(cron.month, date.getMonth() + 1) &&
    match(cron.dayOfWeek, date.getDay())
  );
}

export class AutomationEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private actionRegistry = new Map<string, (params: Record<string, string>) => Promise<void>>();

  registerAction(name: string, handler: (params: Record<string, string>) => Promise<void>): void {
    this.actionRegistry.set(name, handler);
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), 30000);
    logger.info('[AutomationEngine] Started (30s interval)');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[AutomationEngine] Stopped');
    }
  }

  private lastCronCheck = 0;
  private async tick(): Promise<void> {
    try {
      const store = useAutomationStore.getState();
      const rules = store.getEnabledRules();
      if (rules.length === 0) return;

      for (const rule of rules) {
        if (this.shouldSkip(rule)) continue;

        let shouldTrigger = false;
        switch (rule.trigger.type) {
          case 'cron':
            shouldTrigger = this.checkCron(rule);
            break;
          case 'time':
            shouldTrigger = this.checkTime(rule);
            break;
          case 'mood_change':
          case 'entity_mentioned':
          case 'goal_status':
            break;
          case 'notification':
          case 'message':
          case 'file_created':
            break;
          case 'location':
            break;
          case 'app_launched':
            break;
        }

        if (shouldTrigger) {
          await this.executeRule(rule);
        }
      }
    } catch (e) {
      logger.warn('[AutomationEngine] Tick error:', e);
    }
  }

  private shouldSkip(rule: AutomationRule): boolean {
    if (!rule.enabled) return true;

    if (rule.lastTriggered) {
      const elapsed = Date.now() - rule.lastTriggered;
      if (elapsed < rule.trigger.cooldownMs) return true;
    }

    if (rule.maxTriggersPerDay > 0 && rule.triggerCount >= rule.maxTriggersPerDay) {
      const dayStart = Date.now() - 86400000;
      if (rule.lastTriggered && rule.lastTriggered > dayStart) return true;
    }

    return false;
  }

  private checkCron(rule: AutomationRule): boolean {
    try {
      const cron = parseCron(rule.trigger.params.expr || '');
      const now = new Date();
      if (matchesCron(cron, now)) {
          if (this.lastCronCheck === now.getTime()) return false;
        if (rule.lastTriggered) {
          const last = new Date(rule.lastTriggered);
          if (
            last.getHours() === now.getHours() &&
            last.getMinutes() === now.getMinutes()
          ) return false;
        }
        return true;
      }
    } catch (e) {
      logger.warn('[AutomationEngine] Cron parse error:', e);
    }
    return false;
  }

  private checkTime(rule: AutomationRule): boolean {
    const targetTime = rule.trigger.params.time;
    if (!targetTime) return false;

    const [h, m] = targetTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() === h && now.getMinutes() === m) {
      if (rule.lastTriggered) {
        const last = new Date(rule.lastTriggered);
        if (last.getHours() === h && last.getMinutes() === m) return false;
      }
      return true;
    }
    return false;
  }

  fireEvent(type: string, params: Record<string, string>): void {
    const store = useAutomationStore.getState();
    const matchingRules = store.rules.filter(
      (r) => r.enabled && r.trigger.type === type
    );

    for (const rule of matchingRules) {
      const match = Object.entries(params).every(
        ([k, v]) => !rule.trigger.params[k] || rule.trigger.params[k] === v
      );
      if (match) {
        this.executeRule(rule).catch((e) =>
          logger.warn('[AutomationEngine] Event rule execution failed:', e)
        );
      }
    }
  }

  private async executeRule(rule: AutomationRule): Promise<void> {
    logger.info(`[AutomationEngine] Executing rule: ${rule.name}`);

    useAutomationStore.getState().recordTrigger(rule.id);

    for (const action of rule.actions) {
      try {
        await this.executeAction(action.type, action.params);
      } catch (e) {
        logger.warn(`[AutomationEngine] Action ${action.type} failed:`, e);
      }
    }
  }

  private async executeAction(type: string, params: Record<string, string>): Promise<void> {
    const handler = this.actionRegistry.get(type);
    if (handler) {
      await handler(params);
      return;
    }

    switch (type) {
      case 'set_reminder': {
        const text = params.text;
        if (text) {
          useMemoryStore.getState().addMemory({
            key: `reminder:${Date.now()}`,
            value: text,
            category: 'fact',
            tier: 'working',
            confidence: 1.0,
          });
        }
        break;
      }
      case 'notify': {
        if (params.title && params.body) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(params.title, { body: params.body });
          }
        }
        break;
      }
      case 'toggle_feature': {
        if (params.feature) {
          window.dispatchEvent(
            new CustomEvent('gia:toggle-feature', { detail: params.feature })
          );
        }
        break;
      }
      case 'send_message': {
        if (params.text) {
          window.dispatchEvent(
            new CustomEvent('gia:send-message', { detail: params.text })
          );
        }
        break;
      }
      case 'create_goal': {
        if (params.title) {
          window.dispatchEvent(
            new CustomEvent('gia:create-goal', {
              detail: { title: params.title, description: params.description || '' },
            })
          );
        }
        break;
      }
      default:
        logger.warn(`[AutomationEngine] Unknown action type: ${type}`);
    }
  }

  getStatus(): string {
    const store = useAutomationStore.getState();
    const enabled = store.getEnabledRules();
    return `Automation Engine: ${this.intervalId ? 'running' : 'stopped'}, ${enabled.length}/${store.rules.length} rules enabled`;
  }
}

export const automationEngine = new AutomationEngine();
