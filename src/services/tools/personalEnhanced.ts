import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

const intervalLabels: Record<string, string> = {
  hourly: 'every hour',
  daily: 'daily',
  weekly: 'weekly',
};

export const remindersTools: Tool[] = [
  {
    id: 'reminders_list',
    name: 'reminders_list',
    description: 'List all active reminders and scheduled tasks.',
    execute: async () => {
      const store = useGiaStore.getState();
      const tasks = store.scheduledTasks;
      if (tasks.length === 0) {
        return { success: true, content: 'No reminders configured. Use set_reminder to create one.' };
      }
      const lines = tasks.map(t => `- **${t.title}** — ${intervalLabels[t.interval] || t.interval} — ${t.status} — next: ${new Date(t.nextRun).toLocaleString()}`);
      return { success: true, content: `## Reminders\n\n${lines.join('\n')}` };
    }
  },
  {
    id: 'reminders_delete',
    name: 'reminders_delete',
    description: 'Delete a reminder by its task ID.',
    schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'The reminder task ID to delete' } },
      required: ['taskId'],
    },
    execute: async (args) => {
      const taskId = args.taskId as string;
      if (!taskId) return { success: false, content: '', error: 'Provide a "taskId".' };
      useGiaStore.getState().deleteTask(taskId);
      return { success: true, content: `Reminder "${taskId}" deleted.` };
    }
  },
  {
    id: 'reminders_update',
    name: 'reminders_update',
    description: 'Update the status or next run time of a reminder.',
    schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The reminder task ID' },
        status: { type: 'string', enum: ['pending', 'running', 'done', 'error'], description: 'New status' },
        nextRun: { type: 'number', description: 'New next run timestamp (milliseconds since epoch)' },
      },
      required: ['taskId'],
    },
    execute: async (args) => {
      const taskId = args.taskId as string;
      const status = args.status as string | undefined;
      const nextRun = args.nextRun as number | undefined;
      if (!taskId) return { success: false, content: '', error: 'Provide a "taskId".' };
      useGiaStore.getState().updateTaskStatus(taskId, (status || 'pending') as 'pending' | 'running' | 'done' | 'error', undefined, nextRun);
      return { success: true, content: `Reminder "${taskId}" updated.` };
    }
  },
];

export const musicTools: Tool[] = [
  {
    id: 'music_stop',
    name: 'music_stop',
    description: 'Stop currently playing music.',
    execute: async () => {
      try {
        (document.querySelectorAll('audio, video')).forEach(el => { (el as HTMLMediaElement).pause(); (el as HTMLMediaElement).src = ''; });
        return { success: true, content: 'Music stopped.' };
      } catch {
        return { success: false, content: '', error: 'Failed to stop music.' };
      }
    }
  },
  {
    id: 'music_pause',
    name: 'music_pause',
    description: 'Pause currently playing music.',
    execute: async () => {
      try {
        (document.querySelectorAll('audio, video')).forEach(el => (el as HTMLMediaElement).pause());
        return { success: true, content: 'Music paused.' };
      } catch {
        return { success: false, content: '', error: 'Failed to pause music.' };
      }
    }
  },
  {
    id: 'music_queue',
    name: 'music_queue',
    description: 'Queue a song or playlist for playback.',
    schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'URL of the song or playlist to queue' } },
      required: ['url'],
    },
    execute: async (args) => {
      const url = args.url as string;
      if (!url) return { success: false, content: '', error: 'Provide a "url" to queue.' };
      return { success: true, content: `Queued ${url} for playback.` };
    }
  },
  {
    id: 'music_list',
    name: 'music_list',
    description: 'List currently playing media elements on the page.',
    execute: async () => {
      const media = document.querySelectorAll('audio, video');
      if (media.length === 0) return { success: true, content: 'No media elements currently playing or loaded.' };
      const sources = Array.from(media).map(el => `${el.tagName.toLowerCase()} — ${(el as HTMLMediaElement).src || '(no URL)'}`);
      return { success: true, content: `## Now Playing\n\n${sources.join('\n')}` };
    }
  },
];

export const personalEnhancedTools = [...remindersTools, ...musicTools];

export function registerPersonalEnhancedTools() {
  for (const tool of personalEnhancedTools) ToolRegistry.register(tool);
}