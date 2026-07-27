import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const scheduledTaskTools: Tool[] = [
  {
    id: 'scheduled_task_create',
    name: 'scheduled_task_create',
    description: 'Create a scheduled task that runs at a specified interval (hourly, daily, weekly).',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        prompt: { type: 'string', description: 'The prompt to run on each execution' },
        interval: { type: 'string', enum: ['hourly', 'daily', 'weekly'], description: 'How often to run the task' },
      },
      required: ['title', 'prompt', 'interval'],
    },
    execute: async (args) => {
      const title = args.title as string;
      const prompt = args.prompt as string;
      const interval = args.interval as string;
      if (!title || !prompt || !interval) {
        return { success: false, content: '', error: 'Provide "title", "prompt", and "interval" (hourly/daily/weekly).' };
      }
      const task = {
        id: `task-${Date.now()}`,
        title,
        prompt,
        cronLabel: interval,
        interval: interval as 'hourly' | 'daily' | 'weekly',
        nextRun: Date.now() + (interval === 'hourly' ? 3600000 : interval === 'daily' ? 86400000 : 604800000),
        status: 'pending' as const,
      };
      useGiaStore.getState().addScheduledTask(task);
      return { success: true, content: `Scheduled task "${title}" created — will run ${interval}. Task ID: ${task.id}` };
    }
  },
  {
    id: 'scheduled_task_list',
    name: 'scheduled_task_list',
    description: 'List all scheduled tasks with their status and next run time.',
    execute: async () => {
      const store = useGiaStore.getState();
      const tasks = store.scheduledTasks;
      if (tasks.length === 0) {
        return { success: true, content: 'No scheduled tasks.' };
      }
      const lines = tasks.map(t => `- **${t.title}** — ${t.interval} — ${t.status} — next: ${new Date(t.nextRun).toLocaleString()}${t.lastResult ? ` — last result: ${t.lastResult}` : ''}`);
      return { success: true, content: `## Scheduled Tasks\n\n${lines.join('\n')}` };
    }
  },
  {
    id: 'scheduled_task_delete',
    name: 'scheduled_task_delete',
    description: 'Delete a scheduled task by its ID.',
    schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'The task ID to delete' } },
      required: ['taskId'],
    },
    execute: async (args) => {
      const taskId = args.taskId as string;
      if (!taskId) return { success: false, content: '', error: 'Provide a "taskId".' };
      useGiaStore.getState().deleteTask(taskId);
      return { success: true, content: `Scheduled task "${taskId}" deleted.` };
    }
  },
  {
    id: 'scheduled_task_run',
    name: 'scheduled_task_run',
    description: 'Mark a scheduled task as running and set its status to done.',
    schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'The task ID to mark as done' } },
      required: ['taskId'],
    },
    execute: async (args) => {
      const taskId = args.taskId as string;
      if (!taskId) return { success: false, content: '', error: 'Provide a "taskId".' };
      const task = useGiaStore.getState().scheduledTasks.find(t => t.id === taskId);
      if (!task) return { success: false, content: '', error: `Task "${taskId}" not found.` };
      useGiaStore.getState().updateTaskStatus(taskId, 'done', 'Executed manually');
      return { success: true, content: `Task "${task.title}" marked as done.` };
    }
  },
];

export function registerScheduledTaskTools() {
  for (const tool of scheduledTaskTools) ToolRegistry.register(tool);
}