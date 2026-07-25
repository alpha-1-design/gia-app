import { z } from 'zod';
import { Clipboard } from '@capacitor/clipboard';
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

const clipboardRead: Tool = {
  id: 'clipboard_read',
  name: 'clipboard_read',
  description: 'Read text content from the system clipboard. Returns the current clipboard text if available.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Clipboard access requires the GIA mobile app (Android).' };
    }
    try {
      const result = await Clipboard.read();
      const text = result.value ?? '';
      if (!text) {
        return { success: true, content: '## 📋 Clipboard\n\nClipboard is empty.' };
      }
      return {
        success: true,
        content: `## 📋 Clipboard Contents\n\n\`\`\`\n${text.slice(0, 5000)}${text.length > 5000 ? '\n… (truncated)' : ''}\n\`\`\`\n\n_Read from system clipboard._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const clipboardWrite: Tool = {
  id: 'clipboard_write',
  name: 'clipboard_write',
  description: 'Write text to the system clipboard. Copies the provided text so it can be pasted anywhere.',
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to copy to clipboard' },
    },
    required: ['text'],
  },
  execute: async (args) => {
    const schema = z.object({
      text: z.string().min(1, 'Text is required').max(50000, 'Text too long (max 50000 chars)'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Clipboard access requires the GIA mobile app (Android).' };
    }
    try {
      await Clipboard.write({ string: parsed.data.text });
      return {
        success: true,
        content: `## ✏️ Copied to Clipboard\n\n\`\`\`\n${parsed.data.text.slice(0, 500)}${parsed.data.text.length > 500 ? '…' : ''}\n\`\`\`\n\n_Written to system clipboard — ready to paste anywhere._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const clipboardTools: Tool[] = [clipboardRead, clipboardWrite];


export function registerClipboardTools() {
  for (const tool of clipboardTools) ToolRegistry.register(tool);
}
