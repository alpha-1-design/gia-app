import { z } from 'zod';
import { useGiaStore } from '../../store/useGiaStore';
import SkillsMarketplace from '../SkillsMarketplace';
import type { Tool } from './types';

/**
 * Skills are specialized system-prompt behavior packages the user installs.
 * GIA previously could only "see" the active skill passively (it's injected
 * into the base prompt). These tools let GIA enumerate installed skills and
 * SWITCH the active one itself — matching the user's expectation that skills
 * are first-class capabilities, not just a settings toggle.
 */
const skillList: Tool = {
  id: 'skill_list',
  name: 'skill_list',
  description: 'List all installed skills, their categories, and which one is currently active.',
  execute: async () => {
    const { skills, activeSkillId } = useGiaStore.getState();
    if (!skills || skills.length === 0) {
      return { success: true, content: 'No skills installed. Use install_skill to add one, or check Settings → Skills.' };
    }
    const lines = skills.map(s => {
      const active = s.id === activeSkillId ? ' **← ACTIVE**' : '';
      return `- **${s.name}** (\`${s.id}\`) — ${s.description || 'No description'}${s.category ? ` [${s.category}]` : ''}${active}`;
    });
    return { success: true, content: `## Skills (${skills.length})\n\n${lines.join('\n')}\n\nActive: \`${activeSkillId || 'none'}\`` };
  },
};

const skillActivate: Tool = {
  id: 'skill_activate',
  name: 'skill_activate',
  description: 'Switch the active skill. GIA immediately adopts that skill\'s system prompt and behavior for all subsequent work.',
  schema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'The skill id to activate (use skill_list to see available skills)' },
    },
    required: ['skillId'],
  },
  execute: async ({ skillId }) => {
    const id = typeof skillId === 'string' ? skillId : String(skillId ?? '');
    const { skills, activeSkillId } = useGiaStore.getState();
    const skill = skills?.find(s => s.id === id);
    if (!skill) {
      return { success: false, content: '', error: `Skill "${id}" not found. Use skill_list to see installed skills.` };
    }
    if (skill.id === activeSkillId) {
      return { success: true, content: `Skill "${skill.name}" is already active.` };
    }
    useGiaStore.getState().setSkill(id);
    return { success: true, content: `Skill "${skill.name}" activated${skill.systemPrompt ? ' — its instructions now shape all responses' : ''}.` };
  },
};

const skillCreate: Tool = {
  id: 'skill_create',
  name: 'skill_create',
  description: 'Create and activate a custom skill from a name, description, category, system prompt, and optional tool IDs.',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short skill name' },
      description: { type: 'string', description: 'What this skill is for' },
      category: { type: 'string', description: 'Skill category' },
      systemPrompt: { type: 'string', description: 'Instructions added to GIA behavior' },
      tools: { type: 'array', items: { type: 'string' }, description: 'Optional tool IDs' },
    },
    required: ['name', 'description', 'category', 'systemPrompt'],
  },
  execute: async (args) => {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().min(1).max(500),
      category: z.string().trim().min(1).max(40),
      systemPrompt: z.string().trim().min(1).max(10000),
      tools: z.array(z.string().trim().min(1).max(100)).max(100).optional().default([]),
    }).safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(issue => issue.message).join(', ') };
    }
    const skill = await SkillsMarketplace.createCustomSkill(parsed.data);
    useGiaStore.getState().setSkill(skill.id);
    return { success: true, content: `Created and activated custom skill "${skill.name}" (${skill.id}).` };
  },
};

export const skillTools: Tool[] = [skillList, skillActivate, skillCreate];
