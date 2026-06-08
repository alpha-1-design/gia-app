import { useAutonomyStore } from '../../store/useAutonomyStore';
import { useGiaStore } from '../../store/useGiaStore';
import { autonomousAgent } from '../autonomy/AutonomousAgent';
import type { Tool } from './types';

export const autonomyTools: Tool[] = [
  {
    id: 'create_goal',
    name: 'create_goal',
    description: 'Create a new autonomous goal for GIA to work on independently. GIA will plan, execute, and track progress on this goal.',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short goal title (e.g. "Learn Python basics", "Research quantum computing")' },
        description: { type: 'string', description: 'Detailed description of what the goal entails' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority level (default: medium)' },
      },
      required: ['title', 'description'],
    },
    execute: async ({ title, description, priority }) => {
      if (!title || !description) {
        return { success: false, content: '', error: 'Title and description are required' };
      }
      const goalId = await autonomousAgent.createGoal(
        String(title),
        String(description),
        (priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
      );
      const summary = autonomousAgent.getGoalSummary(goalId);
      return { success: true, content: `Goal created successfully.\n\n${summary}` };
    },
  },
  {
    id: 'list_goals',
    name: 'list_goals',
    description: 'List all current autonomous goals with their status and progress.',
    execute: async () => {
      const store = useAutonomyStore.getState();
      const activeGoals = store.getActiveGoals();
      const allGoals = store.goals;

      if (allGoals.length === 0) {
        return { success: true, content: 'No goals have been created yet. Use create_goal to start one.' };
      }

      let content = '## Goals\n\n';
      for (const g of allGoals) {
        const statusIcon = g.status === 'active' ? '🟢' : g.status === 'completed' ? '✅' : g.status === 'failed' ? '❌' : '⏸️';
        const progressBar = '█'.repeat(Math.floor(g.progress / 10)) + '░'.repeat(10 - Math.floor(g.progress / 10));
        content += `${statusIcon} **${g.title}** (${g.priority})\n`;
        content += `   ${progressBar} ${g.progress}% — ${g.status}\n`;
        content += `   ${g.description.slice(0, 120)}\n\n`;
      }

      if (store.config.enabled) {
        const next = store.getNextActionableStep();
        if (next) {
          content += `\n**Next step:** ${next.step.description}`;
        }
      }

      return { success: true, content };
    },
  },
  {
    id: 'pause_goal',
    name: 'pause_goal',
    description: 'Pause or resume an autonomous goal.',
    schema: {
      type: 'object',
      properties: {
        goalTitle: { type: 'string', description: 'Title of the goal to pause/resume (partial match works)' },
        action: { type: 'string', enum: ['pause', 'resume', 'cancel'], description: 'What to do with the goal' },
      },
      required: ['goalTitle', 'action'],
    },
    execute: async ({ goalTitle, action }) => {
      const store = useAutonomyStore.getState();
      const goal = store.goals.find(g =>
        g.title.toLowerCase().includes(String(goalTitle).toLowerCase())
      );
      if (!goal) {
        return { success: false, content: '', error: `No goal found matching "${goalTitle}"` };
      }

      if (action === 'pause') {
        store.setGoalStatus(goal.id, 'paused');
        return { success: true, content: `Goal "${goal.title}" paused.` };
      } else if (action === 'resume') {
        store.setGoalStatus(goal.id, 'active');
        return { success: true, content: `Goal "${goal.title}" resumed.` };
      } else if (action === 'cancel') {
        store.removeGoal(goal.id);
        return { success: true, content: `Goal "${goal.title}" cancelled and removed.` };
      }
      return { success: false, content: '', error: `Unknown action: ${action}` };
    },
  },
  {
    id: 'goal_progress',
    name: 'goal_progress',
    description: 'Get a detailed progress report on a specific goal.',
    schema: {
      type: 'object',
      properties: {
        goalTitle: { type: 'string', description: 'Title of the goal (partial match works)' },
      },
      required: ['goalTitle'],
    },
    execute: async ({ goalTitle }) => {
      const store = useAutonomyStore.getState();
      const goal = store.goals.find(g =>
        g.title.toLowerCase().includes(String(goalTitle).toLowerCase())
      );
      if (!goal) {
        return { success: false, content: '', error: `No goal found matching "${goalTitle}"` };
      }
      return { success: true, content: autonomousAgent.getGoalSummary(goal.id) };
    },
  },
  {
    id: 'set_autonomy_config',
    name: 'set_autonomy_config',
    description: 'Configure GIA autonomous behavior — enable/disable autonomous mode, set proactiveness level.',
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable or disable autonomous background work' },
        proactivenessLevel: { type: 'number', description: 'How proactive GIA should be (0.0 = wait for instructions, 1.0 = very proactive). Default: 0.5' },
      },
    },
    execute: async ({ enabled, proactivenessLevel }) => {
      const store = useAutonomyStore.getState();
      const updates: Record<string, unknown> = {};
      if (typeof enabled === 'boolean') updates.enabled = enabled;
      if (typeof proactivenessLevel === 'number') {
        updates.proactivenessLevel = Math.max(0, Math.min(1, proactivenessLevel));
      }
      store.setConfig(updates as Parameters<typeof store.setConfig>[0]);
      const state = store.config;
      return {
        success: true,
        content: `Autonomy: ${state.enabled ? '✅ ON' : '❌ OFF'}\nProactiveness: ${(state.proactivenessLevel * 100).toFixed(0)}%\nIdle threshold: ${(state.idleThresholdMs / 60000).toFixed(0)}m`,
      };
    },
  },
];
