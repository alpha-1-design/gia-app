import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

interface CodeExecRecord {
  language: string;
  timestamp: number;
  exitCode: number | null;
  codeSnippet: string;
  id: string;
}

export const codeHistoryTools: Tool[] = [
  {
    id: 'code_exec_history',
    name: 'code_exec_history',
    description: 'Show recent code execution history including language, exit code, and timestamp.',
    schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Number of records to show', default: 10 } },
    },
    execute: async (args) => {
      const limit = (args.limit as number) || 10;
      try {
        const raw = localStorage.getItem('gia-code-exec-history');
        const records: CodeExecRecord[] = raw ? JSON.parse(raw) : [];
        const recent = records.slice(0, limit);
        if (recent.length === 0) {
          return { success: true, content: 'No code execution history yet.' };
        }
        const lines = recent.map(r => `- **${r.language}** at ${new Date(r.timestamp).toLocaleString()} — exit ${r.exitCode ?? '—'}`);
        return { success: true, content: `## Code Execution History\n\n${lines.join('\n')}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'code_exec_clear_history',
    name: 'code_exec_clear_history',
    description: 'Clear all code execution history after confirmation.',
    execute: async () => {
      try {
        localStorage.removeItem('gia-code-exec-history');
        return { success: true, content: 'Code execution history cleared.' };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
];

export function registerCodeHistoryTools() {
  for (const tool of codeHistoryTools) ToolRegistry.register(tool);
}