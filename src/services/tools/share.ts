import { z } from 'zod';
import { Share } from '@capacitor/share';
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

const shareContent: Tool = {
  id: 'share_content',
  name: 'share_content',
  description: 'Share content to other apps using the native Android share sheet. Supports text, URLs, and titles. Opens the system share dialog so the user can choose where to share.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Share title/heading' },
      text: { type: 'string', description: 'Main text content to share' },
      url: { type: 'string', description: 'Optional URL to include in the share' },
      dialogTitle: { type: 'string', description: 'Optional dialog title for the share sheet (Android only)' },
    },
    required: ['title', 'text'],
  },
  execute: async (args) => {
    const schema = z.object({
      title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
      text: z.string().min(1, 'Text is required').max(10000, 'Text too long (max 10000 chars)'),
      url: z.string().url('Must be a valid URL').max(2000).optional(),
      dialogTitle: z.string().max(200).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Native sharing requires the GIA mobile app (Android).' };
    }
    try {
      const shareOptions: Record<string, string> = {
        title: parsed.data.title,
        text: parsed.data.text,
      };
      if (parsed.data.url) shareOptions.url = parsed.data.url;
      if (parsed.data.dialogTitle) shareOptions.dialogTitle = parsed.data.dialogTitle;

      await Share.share(shareOptions);

      const urlSuffix = parsed.data.url ? `\n> ${parsed.data.url}` : '';
      return {
        success: true,
        content: `## 🔗 Shared via Native Share Sheet\n\n**Title:** ${parsed.data.title}\n\n**Content:**\n> ${parsed.data.text.slice(0, 300)}${parsed.data.text.length > 300 ? '…' : ''}${urlSuffix}\n\n_Native share sheet opened — user can choose where to share._`,
      };
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('cancel')) {
        return { success: false, content: '', error: 'Share was cancelled by the user.' };
      }
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const shareTools: Tool[] = [shareContent];


export function registerShareTools() {
  for (const tool of shareTools) ToolRegistry.register(tool);
}
