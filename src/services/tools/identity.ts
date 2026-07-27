import { useGiaIdentity, type PersonalityStyle } from '../../store/useGiaIdentity';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const identityTools: Tool[] = [
  {
    id: 'identity_set_name',
    name: 'identity_set_name',
    description: 'Set GIA\'s display name.',
    schema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The name GIA should use' } },
      required: ['name'],
    },
    execute: async ({ name }) => {
      if (!name || typeof name !== 'string') return { success: false, content: '', error: 'Provide a "name" string.' };
      useGiaIdentity.getState().setName(name);
      return { success: true, content: `GIA is now known as "${name}".` };
    }
  },
  {
    id: 'identity_set_personality',
    name: 'identity_set_personality',
    description: 'Set GIA\'s personality: warm, professional, witty, direct, or custom.',
    schema: {
      type: 'object',
      properties: { personality: { type: 'string', enum: ['warm', 'professional', 'witty', 'direct', 'custom'], description: 'The personality style' } },
      required: ['personality'],
    },
    execute: async (args) => {
      const personality = args.personality as string;
      const valid = ['warm', 'professional', 'witty', 'direct', 'custom'];
      if (!personality || !valid.includes(personality)) {
        return { success: false, content: '', error: `Personality must be one of: ${valid.join(', ')}` };
      }
      useGiaIdentity.getState().setPersonality(personality as PersonalityStyle);
      return { success: true, content: `Personality set to "${personality}".` };
    }
  },
  {
    id: 'identity_set_tone',
    name: 'identity_set_tone',
    description: 'Set GIA\'s tone: casual, formal, technical, poetic, academic, or playful.',
    schema: {
      type: 'object',
      properties: { tone: { type: 'string', enum: ['casual', 'formal', 'technical', 'poetic', 'academic', 'playful'], description: 'The tone to use' } },
      required: ['tone'],
    },
    execute: async (args) => {
      const tone = args.tone as string;
      const valid = ['casual', 'formal', 'technical', 'poetic', 'academic', 'playful'];
      if (!tone || !valid.includes(tone)) {
        return { success: false, content: '', error: `Tone must be one of: ${valid.join(', ')}` };
      }
      useGiaIdentity.getState().setTone(tone);
      return { success: true, content: `Tone set to "${tone}".` };
    }
  },
  {
    id: 'identity_set_focus_areas',
    name: 'identity_set_focus_areas',
    description: 'Set GIA\'s focus areas — subjects GIA should prioritize in responses.',
    schema: {
      type: 'object',
      properties: { focusAreas: { type: 'array', items: { type: 'string' }, description: 'List of focus area strings' } },
      required: ['focusAreas'],
    },
    execute: async (args) => {
      const focusAreas = args.focusAreas as string[];
      if (!Array.isArray(focusAreas)) return { success: false, content: '', error: 'Provide a "focusAreas" array of strings.' };
      useGiaIdentity.getState().setFocusAreas(focusAreas);
      return { success: true, content: `Focus areas set: ${focusAreas.join(', ')}.` };
    }
  },
  {
    id: 'identity_get_config',
    name: 'identity_get_config',
    description: 'Get the current GIA identity configuration.',
    execute: async () => {
      const id = useGiaIdentity.getState().identity;
      return { success: true, content: `## GIA Identity\n\n**Name:** ${id.name}\n**Personality:** ${id.personalityStyle}\n**Tone:** ${id.tone}\n**Focus Areas:** ${id.focusAreas.length ? id.focusAreas.join(', ') : '(none)'}\n**Proactiveness:** ${id.proactiveness}\n**Allows Memory:** ${id.allowsMemory}` };
    }
  },
];

export function registerIdentityTools() {
  for (const tool of identityTools) ToolRegistry.register(tool);
}