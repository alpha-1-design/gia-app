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
      if (feature === 'web_search') store.setWebSearch(enabled);
      else if (feature === 'thinking') store.setExtThinking(enabled);
      else if (feature === 'hands_off') store.setHandsOff(enabled);
      else return { success: false, content: '', error: `Invalid feature: ${feature}` };
      store.addNotification(`GIA turned ${feature} ${enabled ? 'ON' : 'OFF'}`);
      return { success: true, content: `${feature} is now ${enabled ? 'enabled' : 'disabled'}` };
    }
  },
  {
    id: 'show_notification', name: 'show_notification',
    description: 'Show a global notification toast to the user.',
    execute: async ({ message }) => {
      useGiaStore.getState().addNotification(message);
      return { success: true, content: 'Notification sent' };
    }
  },
  {
    id: 'request_clarification', name: 'request_clarification',
    description: 'Ask the user a clarifying question when you need more information.',
    execute: async ({ question, options }) => {
      useGiaStore.getState().setClarification({
        question: question || 'Could you clarify?',
        options: Array.isArray(options) && options.length >= 2 ? options : ['Yes', 'No'],
        sessionId: useGiaStore.getState().activeSessionId || '',
        assistantMsgId: '',
      });
      return { success: true, content: '__CLARIFICATION__' };
    }
  }
];
