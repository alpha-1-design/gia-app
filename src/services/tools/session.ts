import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const sessionTools: Tool[] = [
  {
    id: 'session_summarize',
    name: 'session_summarize',
    description: 'Generate a summary of the current session\'s conversation and save it.',
    execute: async () => {
      try {
        const store = useGiaStore.getState();
        const session = store.getActiveSession();
        if (!session) return { success: false, content: '', error: 'No active session.' };
        const messages = session.messages;
        const text = messages.map(m => `${m.message.role}: ${typeof m.message.content === 'string' ? m.message.content.slice(0, 500) : ''}`).join('\n');
        if (!text.trim()) return { success: true, content: 'Session is empty — nothing to summarize.' };
        return { success: true, content: `## Session Summary\n\nSession ID: ${session.id}\nMessages: ${messages.length}\nTitle: ${session.title || '(untitled)'}\n\n**Conversation Content:**\n${text.slice(0, 5000)}\n\n(Use an AI provider to generate a condensed summary of this content.)` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'session_list_summaries',
    name: 'session_list_summaries',
    description: 'List all sessions with their titles, message counts, and last update times.',
    execute: async () => {
      try {
        const store = useGiaStore.getState();
        const sessions = store.sessions;
        if (sessions.length === 0) return { success: true, content: 'No sessions found.' };
        const lines = sessions.map(s => {
          const msgCount = s.messages ? s.messages.length : 0;
          const lastUpdate = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : 'unknown';
          return `- **${s.title || 'Untitled'}** — ${msgCount} messages — updated ${lastUpdate}`;
        });
        return { success: true, content: `## Sessions\n\n${lines.join('\n')}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'session_get',
    name: 'session_get',
    description: 'Get details of a specific session by its ID.',
    schema: {
      type: 'object',
      properties: { sessionId: { type: 'string', description: 'The session ID' } },
      required: ['sessionId'],
    },
    execute: async ({ sessionId }) => {
      try {
        const store = useGiaStore.getState();
        const session = store.sessions.find(s => s.id === sessionId);
        if (!session) return { success: false, content: '', error: `Session "${sessionId}" not found.` };
        const msgCount = session.messages ? session.messages.length : 0;
        return { success: true, content: `## Session: ${session.title || 'Untitled'}\n\n**ID:** ${session.id}\n**Messages:** ${msgCount}\n**Created:** ${session.createdAt ? new Date(session.createdAt).toLocaleString() : 'unknown'}\n**Updated:** ${session.updatedAt ? new Date(session.updatedAt).toLocaleString() : 'unknown'}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
];

export function registerSessionTools() {
  for (const tool of sessionTools) ToolRegistry.register(tool);
}