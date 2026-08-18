import { useGiaStore, type Module } from '../../store/useGiaStore';
import { z } from 'zod';
import type { Tool } from './types';
export const controlTools: Tool[] = [
  {
    id: 'switch_module', name: 'switch_module',
    description: 'Switch the active GIA module (chat, exam, analyst, writer, planner, settings).',
    schema: {
      type: 'object',
      properties: {
        module: { type: 'string', description: 'Module to switch to', enum: ['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'] }
      },
      required: ['module']
    },
    execute: async ({ module }) => {
      const moduleSchema = z.object({
        module: z.enum(['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'])
      });
      const validationResult = moduleSchema.safeParse({ module });
      if (!validationResult.success) {
        return {
          success: false,
          content: '',
          error: `Invalid module: ${validationResult.error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`
        };
      }
      const validatedModule = validationResult.data.module;
      const store = useGiaStore.getState();
      store.setModule(validatedModule as Module);
      store.addNotification(`GIA switched to ${validatedModule} module`);
      return { success: true, content: `Switched to ${validatedModule}` };
    }
  },
  {
    id: 'toggle_feature', name: 'toggle_feature',
    description: 'Enable or disable GIA features (web_search, thinking, hands_off).',
    execute: async ({ feature, enabled }) => {
      const store = useGiaStore.getState();
      if (feature === 'web_search') store.setWebSearch(enabled as boolean);
      else if (feature === 'thinking') store.setExtThinking(enabled as boolean);
      else if (feature === 'hands_off') store.setHandsOff(enabled as boolean);
      else return { success: false, content: '', error: `Invalid feature: ${feature}` };
      store.addNotification(`GIA turned ${feature} ${enabled ? 'ON' : 'OFF'}`);
      return { success: true, content: `${feature} is now ${enabled ? 'enabled' : 'disabled'}` };
    }
  },
  {
    id: 'show_notification', name: 'show_notification',
    description: 'Show a global notification toast to the user.',
    execute: async ({ message }) => {
      useGiaStore.getState().addNotification(message as string);
      return { success: true, content: 'Notification sent' };
    }
  },
  {
    id: 'request_clarification', name: 'request_clarification',
    description: 'Ask the user for information before continuing. For a single quick question, pass `question` and optionally `options` (rendered as tappable buttons, plus a free-text fallback). For several pieces of information at once (e.g. a setup form), pass `fields` instead: an array of { id, label, type, options?, placeholder? } where type is "radio", "select", or "text". Fields render together with one "Send answers" button.',
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question or form intro text shown to the user' },
        options: { type: 'array', items: { type: 'string' }, description: 'Quick-tap answer options for a single question (ignored if fields is provided)' },
        fields: {
          type: 'array',
          description: 'Multiple fields to collect together in one form',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Stable identifier for this field' },
              label: { type: 'string', description: 'The question/label shown for this field' },
              type: { type: 'string', enum: ['radio', 'select', 'text'] },
              options: { type: 'array', items: { type: 'string' }, description: 'Required for radio and select' },
              placeholder: { type: 'string', description: 'Placeholder text, for type "text"' },
            },
            required: ['id', 'label', 'type'],
          },
        },
      },
      required: ['question'],
    },
    execute: async ({ question, options, fields }) => {
      const rawFields = Array.isArray(fields) ? fields as Record<string, unknown>[] : [];
      const parsedFields = rawFields
        .filter((f) => typeof f.id === 'string' && typeof f.label === 'string' && (f.type === 'radio' || f.type === 'select' || f.type === 'text'))
        .map((f) => ({
          id: f.id as string,
          label: f.label as string,
          type: f.type as 'radio' | 'select' | 'text',
          options: Array.isArray(f.options) ? f.options as string[] : undefined,
          placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
        }));

      useGiaStore.getState().setClarification({
        question: (question as string) || 'Could you clarify?',
        options: Array.isArray(options) && options.length >= 2 ? options : ['Yes', 'No'],
        sessionId: useGiaStore.getState().activeSessionId || '',
        assistantMsgId: '',
        fields: parsedFields.length > 0 ? parsedFields : undefined,
      });
      return { success: true, content: '__CLARIFICATION__' };
    }
  }
];
