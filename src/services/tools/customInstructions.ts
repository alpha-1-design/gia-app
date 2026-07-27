import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const customInstructionTools: Tool[] = [
  {
    id: 'custom_instructions_list',
    name: 'custom_instructions_list',
    description: 'List all custom instructions currently configured for GIA.',
    execute: async () => {
      const store = useGiaStore.getState();
      const instructions = store.customInstructions;
      if (!instructions.trim()) {
        return { success: true, content: 'No custom instructions configured yet.' };
      }
      return { success: true, content: `## Custom Instructions\n\n${instructions}` };
    }
  },
  {
    id: 'custom_instructions_add',
    name: 'custom_instructions_add',
    description: 'Add or update a custom instruction for GIA. Overwrites existing instructions if they exist.',
    schema: {
      type: 'object',
      properties: {
        instructions: { type: 'string', description: 'The custom instruction text to set.' },
      },
      required: ['instructions'],
    },
    execute: async ({ instructions }) => {
      if (!instructions || typeof instructions !== 'string') {
        return { success: false, content: '', error: 'Provide an "instructions" string.' };
      }
      const store = useGiaStore.getState();
      store.setCustomInstructions(instructions);
      return { success: true, content: `Custom instructions updated (${instructions.length} chars).` };
    }
  },
  {
    id: 'custom_instructions_update',
    name: 'custom_instructions_update',
    description: 'Append or prepend text to existing custom instructions.',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to add.' },
        mode: { type: 'string', enum: ['append', 'prepend'], description: 'Whether to append or prepend.', default: 'append' },
      },
      required: ['text'],
    },
    execute: async ({ text, mode = 'append' }) => {
      if (!text || typeof text !== 'string') {
        return { success: false, content: '', error: 'Provide "text" to add.' };
      }
      const store = useGiaStore.getState();
      const current = store.customInstructions;
      const updated = mode === 'prepend' ? `${text}\n\n${current}` : `${current}\n\n${text}`;
      store.setCustomInstructions(updated);
      return { success: true, content: `Custom instructions ${mode === 'prepend' ? 'prepended' : 'appended'} (${updated.length} chars total).` };
    }
  },
  {
    id: 'custom_instructions_clear',
    name: 'custom_instructions_clear',
    description: 'Clear all custom instructions.',
    execute: async () => {
      const store = useGiaStore.getState();
      store.setCustomInstructions('');
      return { success: true, content: 'All custom instructions cleared.' };
    }
  },
];

export function registerCustomInstructionTools() {
  for (const tool of customInstructionTools) ToolRegistry.register(tool);
}