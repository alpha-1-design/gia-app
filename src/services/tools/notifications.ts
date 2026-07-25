import { z } from 'zod';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from '../../utils/helpers';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    if (i.code === 'too_small' && 'minimum' in i) {
      const min = (i as { minimum: number }).minimum;
      return `${path}: must be at least ${min} character${min === 1 ? '' : 's'}`;
    }
    return i.message;
  }).join('; ');
}

const sendLocalNotification: Tool = {
  id: 'notifications_send',
  name: 'notifications_send',
  description: 'Send a local push notification immediately. Displays a notification on the device with a title, body text, and optional action-on-tap via a URL/scheme.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title' },
      body: { type: 'string', description: 'Notification body/message text' },
      id: { type: 'number', description: 'Optional notification ID (auto-generated if not provided)' },
      smallIcon: { type: 'string', description: 'Optional small icon name for Android (e.g. "ic_stat_icon")' },
      largeIcon: { type: 'string', description: 'Optional large icon URL for Android' },
      actionTypeId: { type: 'string', description: 'Optional action type ID for notification actions' },
      extra: { type: 'object', description: 'Optional extra data to pass with the notification' },
    },
    required: ['title', 'body'],
  },
  execute: async (args) => {
    const schema = z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long (max 200 chars)'),
      body: z.string().min(1, 'Body is required').max(1000, 'Body too long (max 1000 chars)'),
      id: z.number().int().positive().optional(),
      smallIcon: z.string().max(100).optional(),
      largeIcon: z.string().max(500).optional(),
      actionTypeId: z.string().max(100).optional(),
      extra: z.any().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      const notifId = parsed.data.id ?? Math.floor(Math.random() * 100000) + 1;
      const notification = {
        title: parsed.data.title,
        body: parsed.data.body,
        id: notifId,
        smallIcon: parsed.data.smallIcon,
        largeIcon: parsed.data.largeIcon,
        actionTypeId: parsed.data.actionTypeId,
        extra: parsed.data.extra,
      };

      await LocalNotifications.schedule({ notifications: [notification] });
      return {
        success: true,
        content: `## 🔔 Notification Sent\n\n**Title:** ${parsed.data.title}\n**Body:** ${parsed.data.body}\n**ID:** ${notifId}\n\n_Notification displayed on device._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const scheduleNotification: Tool = {
  id: 'notifications_schedule',
  name: 'notifications_schedule',
  description: 'Schedule a local notification to be delivered at a specific future time. Provide a schedule date/time and the notification content.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title' },
      body: { type: 'string', description: 'Notification body/message text' },
      scheduleAt: { type: 'string', description: 'ISO 8601 datetime string for when to fire the notification (e.g. "2025-06-14T15:30:00.000Z")' },
      id: { type: 'number', description: 'Optional notification ID (auto-generated if not provided)' },
      repeats: { type: 'boolean', description: 'Whether the notification should repeat daily (default: false)' },
      smallIcon: { type: 'string', description: 'Optional small icon name for Android' },
      extra: { type: 'object', description: 'Optional extra data to pass with the notification' },
    },
    required: ['title', 'body', 'scheduleAt'],
  },
  execute: async (args) => {
    const schema = z.object({
      title: z.string().min(1, 'Title is required').max(200),
      body: z.string().min(1, 'Body is required').max(1000),
      scheduleAt: z.string().min(1, 'Schedule time is required').refine(
        v => !isNaN(Date.parse(v)),
        'Must be a valid ISO 8601 datetime string',
      ),
      id: z.number().int().positive().optional(),
      repeats: z.boolean().default(false),
      smallIcon: z.string().max(100).optional(),
      extra: z.any().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      const notifId = parsed.data.id ?? Math.floor(Math.random() * 100000) + 1;
      const fireDate = new Date(parsed.data.scheduleAt);
      const notification = {
        title: parsed.data.title,
        body: parsed.data.body,
        id: notifId,
        schedule: {
          at: fireDate,
          repeats: parsed.data.repeats,
        },
        smallIcon: parsed.data.smallIcon,
        extra: parsed.data.extra,
      };

      await LocalNotifications.schedule({ notifications: [notification] });
      return {
        success: true,
        content: `## 🔔 Notification Scheduled\n\n**Title:** ${parsed.data.title}\n**Body:** ${parsed.data.body}\n**ID:** ${notifId}\n**Scheduled at:** ${fireDate.toISOString()}${parsed.data.repeats ? ' _(repeats daily)_' : ''}\n\n_Notification will be delivered at the scheduled time._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const cancelNotification: Tool = {
  id: 'notifications_cancel',
  name: 'notifications_cancel',
  description: 'Cancel a pending or delivered local notification by its ID.',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'Notification ID to cancel' },
    },
    required: ['id'],
  },
  execute: async (args) => {
    const schema = z.object({
      id: z.number().int().positive('Notification ID must be a positive integer'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      await LocalNotifications.cancel({ notifications: [{ id: parsed.data.id }] });
      return {
        success: true,
        content: `## 🔕 Notification Cancelled\n\n**ID:** ${parsed.data.id}\n\n_Notification cancelled._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const getPendingNotifications: Tool = {
  id: 'notifications_pending',
  name: 'notifications_pending',
  description: 'Get a list of all currently pending/scheduled local notifications that have not yet been delivered.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      const result = await LocalNotifications.getPending();
      const notifs = result.notifications;
      if (!notifs || notifs.length === 0) {
        return { success: true, content: '## 🔔 Pending Notifications\n\nNo pending notifications.' };
      }
      const lines = notifs.map((n, i) => {
        const scheduleInfo = n.schedule?.at
          ? ` (at ${new Date(n.schedule.at).toISOString()}${n.schedule.repeats ? ', repeats' : ''})`
          : ' (immediate)';
        return `${i + 1}. **${n.title}**${scheduleInfo}\n   ${n.body.slice(0, 100)}`;
      });
      return {
        success: true,
        content: `## 🔔 Pending Notifications\n\n${lines.join('\n\n')}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const checkNotificationPermissions: Tool = {
  id: 'notifications_check_permissions',
  name: 'notifications_check_permissions',
  description: 'Check whether local notification permissions are currently granted on the device.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      const result = await LocalNotifications.checkPermissions();
      const state = result.display === 'granted' ? '✅ Granted' : `❌ ${result.display || 'denied'}`;
      return {
        success: true,
        content: `## 🔔 Notification Permissions\n\n**Permission State:** ${state}\n\n_Use \`notifications_request_permissions\` if not granted._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const requestNotificationPermissions: Tool = {
  id: 'notifications_request_permissions',
  name: 'notifications_request_permissions',
  description: 'Request notification permissions from the user. Required on Android 13+ for local notifications.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Local notifications require the GIA mobile app (Android).' };
    }
    try {
      const result = await LocalNotifications.requestPermissions();
      const state = result.display === 'granted' ? '✅ Granted' : `❌ ${result.display || 'denied'}`;
      return {
        success: true,
        content: `## 🔔 Permission Request Result\n\n**Permission State:** ${state}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const notificationTools: Tool[] = [
  sendLocalNotification,
  scheduleNotification,
  cancelNotification,
  getPendingNotifications,
  checkNotificationPermissions,
  requestNotificationPermissions,
];


export function registerNotificationTools() {
  for (const tool of notificationTools) ToolRegistry.register(tool);
}
