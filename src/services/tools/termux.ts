import { z } from 'zod';
import type { Tool } from './types';
import termuxService from '../TermuxService';

const termuxStatus: Tool = {
  id: 'termux_status',
  name: 'termux_status',
  description: 'Check whether Termux is installed on this Android phone. Termux is optional and separate from GIA.',
  execute: async () => ({
    success: true,
    content: (await termuxService.isInstalled())
      ? 'Termux is installed and can receive approved background commands.'
      : 'Termux is not installed on this phone.',
  }),
};

const termuxRun: Tool = {
  id: 'termux_run',
  name: 'termux_run',
  description: 'Start an explicitly requested command in the user’s Termux app. This never installs packages or runs hidden commands; ask for confirmation before mutating or network actions.',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Absolute command path or executable name' },
      args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
      workdir: { type: 'string', description: 'Optional Termux working directory' },
    },
    required: ['command'],
  },
  execute: async (args) => {
    const parsed = z.object({
      command: z.string().min(1).max(500),
      args: z.array(z.string().max(1000)).max(50).default([]),
      workdir: z.string().max(1000).optional(),
    }).safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.message };
    try {
      const result = await termuxService.run(parsed.data.command, parsed.data.args, parsed.data.workdir);
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const exitCode = result.exitCode ?? 0;
      return {
        success: exitCode === 0,
        content: `Termux job ${result.jobId} finished with exit code ${exitCode}.${output ? `\n\nOutput:\n${output}` : ''}`,
        error: exitCode === 0 ? undefined : (result.stderr || `Termux exited with code ${exitCode}`),
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const termuxTools: Tool[] = [termuxStatus, termuxRun];
