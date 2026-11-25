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
  /** Never sleep longer than this before re-checking (drift / rule changes). */
  private static readonly MAX_SCHEDULE_DELAY_MS = 15 * 60_000;
  /** Fire this far into the target minute so the minute check still matches. */
  private static readonly TICK_LEAD_IN_MS = 1_000;

  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private unsubscribeStore: (() => void) | null = null;
  private actionRegistry = new Map<string, (params: Record<string, string>) => Promise<void>>();

  registerAction(name: string, handler: (params: Record<string, string>) => Promise<void>): void {
    this.actionRegistry.set(name, handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribeStore = useAutomationStore.subscribe(() => this.onRulesChanged());
    this.scheduleNext();
    logger.info('[AutomationEngine] Started (self-scheduling to the next due rule)');
  }

  stop(): void {
    if (!this.running && !this.scheduleTimer) return;
    this.running = false;
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    logger.info('[AutomationEngine] Stopped');
  }

  /** Rule added/updated/deleted: restart scheduling so new rules are honoured. */
  private onRulesChanged(): void {
    if (!this.running) return;
    this.scheduleNext();
  }

  /**
   * Battery: instead of a 30s cron tick that wakes JS even with no rules,
   * sleep until the next rule could actually fire (capped at 15 min) and
   * schedule nothing at all when there are no time/cron rules — a rule
   * change restarts scheduling via the store subscription.
   *
   * @param currentMinuteChecked true when rescheduling after a tick: that
   *   tick already evaluated the current minute, so the next tick must aim
   *   beyond it (otherwise it would re-schedule itself every second until
   *   the minute rolls over).
   */
  private scheduleNext(currentMinuteChecked = false): void {
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    if (!this.running) return;
    const delay = this.nextScheduleDelay(currentMinuteChecked);
    if (delay === null) return;   // nothing scheduled — wait for a rule change
    this.scheduleTimer = setTimeout(() => {
      this.scheduleTimer = null;
      void this.tick();
    }, delay);
  }

  /** Delay to the next due rule (clamped to MAX_SCHEDULE_DELAY_MS), or null when nothing to wait for. */
  private nextScheduleDelay(currentMinuteChecked: boolean): number | null {
    const rules = useAutomationStore.getState().getEnabledRules();
    const now = new Date();
    let nextDue: number | null = null;
    let hasScheduledTrigger = false;
    for (const rule of rules) {
      let due: number | null = null;
      if (rule.trigger.type === 'time') {
        due = this.nextTimeTriggerDue(rule, now, currentMinuteChecked);
      } else if (rule.trigger.type === 'cron') {
        due = this.nextCronTriggerDue(rule, now, currentMinuteChecked);
      } else {
        continue;   // event-driven trigger: fired via fireEvent, never wakes JS
      }
      hasScheduledTrigger = true;
      if (due !== null && (nextDue === null || due < nextDue)) nextDue = due;
    }
    if (nextDue === null) {
      // No waitable rule (event-only or unparsable): only keep a slow
      // heartbeat when a cron/time rule exists whose next due lies beyond
      // the 24h scan horizon (e.g. a monthly cron).
      return hasScheduledTrigger ? AutomationEngine.MAX_SCHEDULE_DELAY_MS : null;
    }
    return Math.min(nextDue - Date.now(), AutomationEngine.MAX_SCHEDULE_DELAY_MS);
  }

  /** Next fire time for a "HH:MM" time trigger, keeping a minute that already started. */
  private nextTimeTriggerDue(rule: AutomationRule, from: Date, currentMinuteChecked: boolean): number | null {
    const time = rule.trigger.params.time;
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const due = new Date(from);
    due.setHours(h, m, 0, 0);
    if (due.getTime() < from.getTime() + AutomationEngine.TICK_LEAD_IN_MS) {
      // The target minute already started: still fire inside it if we can
      // (only when this minute hasn't been evaluated yet), otherwise aim
      // for the same time tomorrow.
      if (!currentMinuteChecked && from.getTime() - due.getTime() < 59_000) {
        return from.getTime() + AutomationEngine.TICK_LEAD_IN_MS;
      }
      due.setDate(due.getDate() + 1);
    }
    return due.getTime();
  }

  /** Next fire time for a cron trigger (scans up to 24h ahead); null if nothing matches. */
  private nextCronTriggerDue(rule: AutomationRule, from: Date, currentMinuteChecked: boolean): number | null {
    try {
      const cron = parseCron(rule.trigger.params.expr || '');
      const cand = new Date(from);
      cand.setSeconds(0, 0);
      if (matchesCron(cron, cand) && !currentMinuteChecked && from.getTime() - cand.getTime() < 59_000) {
        return from.getTime() + AutomationEngine.TICK_LEAD_IN_MS;
      }
      for (let i = 0; i < 24 * 60; i++) {
        cand.setMinutes(cand.getMinutes() + 1);
        if (matchesCron(cron, cand)) return cand.getTime() + AutomationEngine.TICK_LEAD_IN_MS;
      }
    } catch (e) {
      logger.warn('[AutomationEngine] Cron parse error:', e);
    }
    return null;
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
    } finally {
      this.scheduleNext(true);
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
    return `Automation Engine: ${this.running ? 'running' : 'stopped'}, ${enabled.length}/${store.rules.length} rules enabled`;
  }
}

export const automationEngine = new AutomationEngine();
