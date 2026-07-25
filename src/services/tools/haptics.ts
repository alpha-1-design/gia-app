import { z } from 'zod';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
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
    return i.message;
  }).join('; ');
}

const hapticImpact: Tool = {
  id: 'haptic_impact',
  name: 'haptic_impact',
  description: 'Trigger a haptic impact feedback. Use light/medium/heavy for different physical feedback intensities (e.g. UI tap, button press, thud).',
  schema: {
    type: 'object',
    properties: {
      style: { type: 'string', enum: ['light', 'medium', 'heavy'], description: 'Impact strength: light (UI tap), medium (button press), heavy (thud)' },
    },
    required: ['style'],
  },
  execute: async (args) => {
    const schema = z.object({
      style: z.enum(['light', 'medium', 'heavy']).default('medium'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Haptics require the GIA mobile app (Android).' };
    }
    try {
      const styleMap: Record<string, ImpactStyle> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: styleMap[parsed.data.style] });
      return {
        success: true,
        content: `## 📳 Haptic Impact\n\n**Style:** ${parsed.data.style}\n\n_Haptic feedback triggered._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const hapticNotification: Tool = {
  id: 'haptic_notification',
  name: 'haptic_notification',
  description: 'Trigger a haptic notification feedback. Use success/warning/error to convey different system events.',
  schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['success', 'warning', 'error'], description: 'Notification type: success (positive), warning (caution), error (failure)' },
    },
    required: ['type'],
  },
  execute: async (args) => {
    const schema = z.object({
      type: z.enum(['success', 'warning', 'error']).default('success'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Haptics require the GIA mobile app (Android).' };
    }
    try {
      const typeMap: Record<string, NotificationType> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      await Haptics.notification({ type: typeMap[parsed.data.type] });
      return {
        success: true,
        content: `## 📳 Haptic Notification\n\n**Type:** ${parsed.data.type}\n\n_Haptic notification feedback triggered._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const hapticVibrate: Tool = {
  id: 'haptic_vibrate',
  name: 'haptic_vibrate',
  description: 'Trigger a continuous vibration for a specified duration in milliseconds. For patterned feedback use haptic_impact or haptic_notification instead.',
  schema: {
    type: 'object',
    properties: {
      duration: { type: 'number', description: 'Vibration duration in milliseconds (100-5000)' },
    },
    required: ['duration'],
  },
  execute: async (args) => {
    const schema = z.object({
      duration: z.number().min(100, 'Duration must be at least 100ms').max(5000, 'Duration max 5000ms'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Haptics require the GIA mobile app (Android).' };
    }
    try {
      await Haptics.vibrate({ duration: parsed.data.duration });
      return {
        success: true,
        content: `## 📳 Device Vibrated\n\n**Duration:** ${parsed.data.duration}ms\n\n_Vibration triggered._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const hapticsTools: Tool[] = [hapticImpact, hapticNotification, hapticVibrate];


export function registerHapticsTools() {
  for (const tool of hapticsTools) ToolRegistry.register(tool);
}
