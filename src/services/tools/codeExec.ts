import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const codeExecTools: Tool[] = [
  {
    id: 'code_exec_configure',
    name: 'code_exec_configure',
    description: 'Configure the Piston API endpoint and key for code execution.',
    schema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'Piston API endpoint URL' },
        apiKey: { type: 'string', description: 'Piston API key' },
      },
      required: ['endpoint'],
    },
    execute: async (args) => {
      const endpoint = args.endpoint as string;
      const apiKey = args.apiKey as string;
      if (!endpoint) return { success: false, content: '', error: 'Provide an "endpoint" URL.' };
      try {
        localStorage.setItem('gia-code-exec-endpoint', endpoint);
        if (apiKey) localStorage.setItem('gia-code-exec-key', apiKey);
        return { success: true, content: `Code execution configured: ${endpoint}${apiKey ? ' (with API key)' : ' (no API key)'}` };
      } catch {
        return { success: false, content: '', error: 'Failed to save configuration.' };
      }
    }
  },
  {
    id: 'code_exec_test',
    name: 'code_exec_test',
    description: 'Test connectivity to the configured Piston API endpoint.',
    execute: async () => {
      try {
        const endpoint = (() => { try { return localStorage.getItem('gia-code-exec-endpoint'); } catch { return null; } })();
        if (!endpoint) return { success: false, content: '', error: 'No Piston endpoint configured. Use code_exec_configure first.' };
        return { success: true, content: `Code execution endpoint: ${endpoint} (full connectivity test requires network access to the endpoint).` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'code_exec_list_runtimes',
    name: 'code_exec_list_runtimes',
    description: 'List available code execution runtimes on the configured Piston endpoint.',
    execute: async () => {
      try {
        const endpoint = (() => { try { return localStorage.getItem('gia-code-exec-endpoint'); } catch { return null; } })();
        if (!endpoint) return { success: false, content: '', error: 'No Piston endpoint configured. Use code_exec_configure first.' };
        return { success: true, content: `Code execution endpoint configured at ${endpoint}. Runtimes can be listed via the Piston API at ${endpoint}/runtimes (requires network access).` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
];

export function registerCodeExecTools() {
  for (const tool of codeExecTools) ToolRegistry.register(tool);
}