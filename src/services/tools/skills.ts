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

const skillLoad: Tool = {
  id: 'skill_load',
  name: 'skill_load',
  description: 'Load the full instructions for an installed skill before beginning a matching user request. This does not change the persistent active skill.',
  schema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'The exact installed skill id from the skill catalog' },
    },
    required: ['skillId'],
  },
  execute: async ({ skillId }) => {
    const id = typeof skillId === 'string' ? skillId : String(skillId ?? '');
    const skill = useGiaStore.getState().skills.find((candidate) => candidate.id === id);
    if (!skill) {
      return { success: false, content: '', error: `Skill "${id}" is not installed. Use the installed skill catalog and do not load marketplace-only skills.` };
    }

    const instructions = SkillsMarketplace.getBuiltinSystemPrompt(id) || skill.systemPrompt;
    if (!instructions.trim()) {
      return { success: false, content: '', error: `Skill "${skill.name}" has no instructions to load.` };
    }

    return {
      success: true,
      content: `## Loaded skill: ${skill.name}\n${skill.description}\n\nFollow these instructions for the current request:\n\n${instructions}`,
    };
  },
};

const skillActivate: Tool = {
  id: 'skill_activate',
  name: 'skill_activate',
  description: 'Set an installed skill as the persistent active specialization for later turns. For the current matching task, use skill_load to retrieve its full instructions.',
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
      return { success: true, content: `Skill "${skill.name}" is already active for later turns. Use skill_load to retrieve its full instructions for the current task.` };
    }
    useGiaStore.getState().setSkill(id);
    return { success: true, content: `Skill "${skill.name}" is now the persistent active specialization. Use skill_load to retrieve its full instructions before doing a matching current task.` };
  },
};

const skillCreate: Tool = {
  id: 'skill_create',
  name: 'skill_create',
  description: 'Create and activate a custom skill. Write a detailed playbook with scope, step-by-step workflow, quality checks, safety boundaries, and expected response format; do not submit a one-line role prompt.',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short skill name' },
      description: { type: 'string', description: 'What this skill is for' },
      category: { type: 'string', description: 'Skill category' },
      systemPrompt: { type: 'string', description: 'Detailed instructions: role and scope, workflow, quality checks, safety boundaries, and expected output format (at least 300 characters)' },
      tools: { type: 'array', items: { type: 'string' }, description: 'Optional tool IDs' },
    },
    required: ['name', 'description', 'category', 'systemPrompt'],
  },
  execute: async (args) => {
    const parsed = z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().min(1).max(500),
      category: z.string().trim().min(1).max(40),
      systemPrompt: z.string().trim().min(300, 'Write a detailed skill playbook of at least 300 characters').max(10000),
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

export const skillTools: Tool[] = [skillList, skillLoad, skillActivate, skillCreate];
