import { logger } from '../utils/logger';

export interface IncomingNotification {
  id: string;
  title: string;
  body: string;
  source: string;
  timestamp: number;
  category?: NotificationCategory;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export type NotificationCategory =
  | 'security'
  | 'calendar'
  | 'message'
  | 'email'
  | 'social'
  | 'app_update'
  | 'promotional'
  | 'system'
  | 'unknown';

export type NotificationAction = 'immediate' | 'batch' | 'silent';

export interface NotificationDecision {
  notification: IncomingNotification;
  action: NotificationAction;
  reason: string;
  batchId?: string;
}

export interface NotificationBatch {
  id: string;
  notifications: IncomingNotification[];
  createdAt: number;
  delivered: boolean;
}

interface UserFeedback {
  notificationId: string;
  category: NotificationCategory;
  source: string;
  userAction: 'dismissed' | 'acted_on';
  timestamp: number;
}

interface SourcePreference {
  source: string;
  immediateCount: number;
  dismissedCount: number;
  totalCount: number;
}

const BATCH_INTERVAL_MS = 30 * 60 * 1000;
const CALENDAR_URGENCY_MS = 15 * 60 * 1000;

const PRIORITY_CONTACT_SOURCES = new Set([
  'family',
  'partner',
  'boss',
  'emergency',
]);

const SECURITY_KEYWORDS = [
  'security alert',
  'unauthorized',
  'breach',
  'suspicious',
  'login attempt',
  'password changed',
  'two-factor',
  'locked out',
  'compromised',
];

const PROMOTIONAL_KEYWORDS = [
  'sale',
  'discount',
  'offer',
  'deal',
  'limited time',
  'unsubscribe',
  'promo',
  'newsletter',
  'marketing',
];

const SOCIAL_SOURCES = new Set([
  'instagram',
  'twitter',
  'facebook',
  'tiktok',
  'reddit',
  'linkedin',
]);

const EMAIL_SOURCES = new Set([
  'gmail',
  'outlook',
  'mail',
  'email',
]);

const SYSTEM_SOURCES = new Set([
  'android',
  'ios',
  'system',
  'os',
  'firmware',
]);

const userFeedbackLog: UserFeedback[] = [];
const sourcePreferences = new Map<string, SourcePreference>();
const pendingBatches: NotificationBatch[] = [];
let totalDecisions = 0;
let correctDecisions = 0;
const nextBatchId = 1;

function classifyCategory(notification: IncomingNotification): NotificationCategory {
  if (notification.category) return notification.category;

  const titleLower = notification.title.toLowerCase();
  const bodyLower = notification.body.toLowerCase();
  const combined = `${titleLower} ${bodyLower}`;

  if (SECURITY_KEYWORDS.some(k => combined.includes(k))) return 'security';
  if (notification.source === 'calendar' || combined.includes('reminder') || combined.includes('event in')) return 'calendar';
  if (notification.source === 'messaging' || notification.source === 'sms') return 'message';
  if (EMAIL_SOURCES.has(notification.source.toLowerCase())) return 'email';
  if (SOCIAL_SOURCES.has(notification.source.toLowerCase())) return 'social';
  if (notification.source.toLowerCase().includes('update') || combined.includes('update available')) return 'app_update';
  if (PROMOTIONAL_KEYWORDS.some(k => combined.includes(k))) return 'promotional';
  if (SYSTEM_SOURCES.has(notification.source.toLowerCase())) return 'system';

  return 'unknown';
}

function getSourcePreference(source: string): SourcePreference {
  const existing = sourcePreferences.get(source);
  if (existing) return existing;
  const pref: SourcePreference = { source, immediateCount: 0, dismissedCount: 0, totalCount: 0 };
  sourcePreferences.set(source, pref);
  return pref;
}

function getDismissalRate(source: string): number {
  const pref = getSourcePreference(source);
  if (pref.totalCount < 3) return 0;
  return pref.dismissedCount / pref.totalCount;
}

function isCalendarUrgent(notification: IncomingNotification): boolean {
  const category = classifyCategory(notification);
  if (category !== 'calendar') return false;

  const combined = `${notification.title} ${notification.body}`;
  const timeMatch = combined.match(/(\d+)\s*(min|minute|hour|hr)/i);
  if (!timeMatch) return false;

  const value = parseInt(timeMatch[1], 10);
  const unit = timeMatch[2].toLowerCase();
  const ms = unit.startsWith('h') ? value * 60 * 60 * 1000 : value * 60 * 1000;
  return ms <= CALENDAR_URGENCY_MS;
}

function isPrioritySource(notification: IncomingNotification): boolean {
  return PRIORITY_CONTACT_SOURCES.has(notification.source.toLowerCase());
}

function decide(notification: IncomingNotification): NotificationDecision {
  const category = classifyCategory(notification);
  const priority = notification.priority;
  const dismissalRate = getDismissalRate(notification.source);

  totalDecisions++;

  if (category === 'security' || priority === 'critical') {
    correctDecisions++;
    return { notification, action: 'immediate', reason: `Security/critical: category=${category}, priority=${priority ?? 'none'}` };
  }

  if (isPrioritySource(notification)) {
    correctDecisions++;
    return { notification, action: 'immediate', reason: `Priority contact source: ${notification.source}` };
  }

  if (isCalendarUrgent(notification)) {
    correctDecisions++;
    return { notification, action: 'immediate', reason: 'Calendar event within 15 minutes' };
  }

  if (category === 'promotional' || (dismissalRate > 0.85 && notification.priority !== 'high')) {
    return { notification, action: 'silent', reason: `Promotional or high dismissal rate (${(dismissalRate * 100).toFixed(0)}%)` };
  }

  if (category === 'system' && priority !== 'high') {
    return { notification, action: 'silent', reason: 'Low-priority system event' };
  }

  if (category === 'email' || category === 'social' || category === 'app_update') {
    if (dismissalRate > 0.7) {
      return { notification, action: 'silent', reason: `Batched category with high dismissal rate (${(dismissalRate * 100).toFixed(0)}%)` };
    }
    const batchId = `batch-${Date.now()}`;
    return { notification, action: 'batch', reason: `Batched: ${category} notification`, batchId };
  }

  if (priority === 'high') {
    correctDecisions++;
    return { notification, action: 'immediate', reason: 'High priority override' };
  }

  return { notification, action: 'batch', reason: `Default batching for category=${category}` };
}

function updateSourcePreference(source: string, wasDismissed: boolean): void {
  const pref = getSourcePreference(source);
  pref.totalCount++;
  if (wasDismissed) pref.dismissedCount++;
  else pref.immediateCount++;
}

class SmartNotificationEngine {
  private static instance: SmartNotificationEngine;

  static getInstance(): SmartNotificationEngine {
    if (!SmartNotificationEngine.instance) {
      SmartNotificationEngine.instance = new SmartNotificationEngine();
    }
    return SmartNotificationEngine.instance;
  }

  process(notification: IncomingNotification): NotificationDecision {
    const decision = decide(notification);

    if (decision.action === 'batch' && decision.batchId) {
      let batch = pendingBatches.find(b => b.id === decision.batchId && !b.delivered);
      if (!batch) {
        batch = { id: decision.batchId, notifications: [], createdAt: Date.now(), delivered: false };
        pendingBatches.push(batch);
      }
      batch.notifications.push(notification);
    }

    logger.debug(`[SmartNotification] ${decision.action.toUpperCase()} — ${notification.source}: ${notification.title} (${decision.reason})`);
    return decision;
  }

  learn(notificationId: string, userAction: 'dismissed' | 'acted_on'): void {
    const entry = userFeedbackLog.find(f => f.notificationId === notificationId);
    if (entry) {
      entry.userAction = userAction;
      updateSourcePreference(entry.source, userAction === 'dismissed');
      logger.debug(`[SmartNotification] Learned: ${entry.source} → ${userAction}`);
    } else {
      logger.debug(`[SmartNotification] Feedback for untracked notification: ${notificationId} → ${userAction}`);
    }
  }

  learnWithContext(
    notificationId: string,
    source: string,
    category: NotificationCategory,
    userAction: 'dismissed' | 'acted_on',
  ): void {
    const feedback: UserFeedback = {
      notificationId,
      category,
      source,
      userAction,
      timestamp: Date.now(),
    };

    const existing = userFeedbackLog.findIndex(f => f.notificationId === notificationId);
    if (existing >= 0) {
      userFeedbackLog[existing] = feedback;
    } else {
      userFeedbackLog.push(feedback);
    }

    const wasDismissed = userAction === 'dismissed';
    updateSourcePreference(source, wasDismissed);
    logger.debug(`[SmartNotification] Learned: ${source}/${category} → ${userAction}`);
  }

  getPendingDigest(): NotificationBatch[] {
    return pendingBatches
      .filter(b => !b.delivered)
      .map(b => ({ ...b, notifications: [...b.notifications] }));
  }

  deliverDigest(batchId: string): NotificationBatch | undefined {
    const batch = pendingBatches.find(b => b.id === batchId && !b.delivered);
    if (!batch) return undefined;
    batch.delivered = true;
    logger.info(`[SmartNotification] Delivered digest batch ${batchId} with ${batch.notifications.length} notifications`);
    return { ...batch, notifications: [...batch.notifications] };
  }

  deliverAllDue(): NotificationBatch[] {
    const now = Date.now();
    const due: NotificationBatch[] = [];
    for (const batch of pendingBatches) {
      if (!batch.delivered && now - batch.createdAt >= BATCH_INTERVAL_MS) {
        batch.delivered = true;
        due.push({ ...batch, notifications: [...batch.notifications] });
      }
    }
    if (due.length > 0) {
      logger.info(`[SmartNotification] Delivered ${due.length} due digest batches`);
    }
    return due;
  }

  getStats(): {
    totalDecisions: number;
    correctDecisions: number;
    accuracy: number;
    sourcePreferences: Record<string, SourcePreference>;
    feedbackCount: number;
    pendingBatchCount: number;
    pendingNotificationCount: number;
  } {
    return {
      totalDecisions,
      correctDecisions,
      accuracy: totalDecisions > 0 ? correctDecisions / totalDecisions : 0,
      sourcePreferences: Object.fromEntries(sourcePreferences),
      feedbackCount: userFeedbackLog.length,
      pendingBatchCount: pendingBatches.filter(b => !b.delivered).length,
      pendingNotificationCount: pendingBatches
        .filter(b => !b.delivered)
        .reduce((sum, b) => sum + b.notifications.length, 0),
    };
  }

  resetStats(): void {
    totalDecisions = 0;
    correctDecisions = 0;
  }

  clearBatches(): void {
    pendingBatches.length = 0;
  }
}

export default SmartNotificationEngine.getInstance();
