import { z } from 'zod';
import type { Tool } from './types';
import termuxService from '../TermuxService';

const termuxStatus: Tool = {
  id: 'termux_status',
  name: 'termux_status',
  description:
    'Check whether Termux is installed AND actually able to run commands from GIA. ' +
    'Reports whether the Termux bridge is ready, or what the user must change to enable it.',
  execute: async () => {
    const status = await termuxService.status();

    if (!status.installed) {
      return {
        success: false,
        content: `Termux is not installed on this phone.\n\n${status.hint}`,
        error: status.hint,
      };
    }

    if (status.ready) {
      const confirmed = status.bridgeResponsive
        ? 'Termux responded to a live round-trip probe, so approved commands will run.'
        : 'Termux reports allow-external-apps = true, but GIA could not confirm a live round trip.';
      return {
        success: true,
        content:
          `Termux bridge READY. Installed: yes. allow-external-apps: ${status.allowExternalApps ? 'enabled' : 'unknown'}.\n` +
          `${confirmed}\n\nYou can send explicitly approved commands with termux_run.`,
      };
    }

    // Installed but not usable — this is the case that used to silently hang.
    return {
      success: false,
      content:
        `Termux is INSTALLED but NOT READY to run commands from GIA.\n` +
        `Bridge responded: no. allow-external-apps: not enabled or unreadable.\n\n` +
        `To fix: ${status.hint}\n` +
        'Until then, termux_run will time out — do not attempt it.',
      error: status.hint,
    };
  },
};

const termuxRun: Tool = {
  id: 'termux_run',
  name: 'termux_run',
  description:
    'Start an explicitly requested command in the user’s Termux app. Requires a working Termux ' +
    'bridge (see termux_status). This never installs packages or runs hidden commands; ask for ' +
    'confirmation before mutating or network actions. Always returns within 30 seconds.',
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

    // Fail fast with an actionable message rather than burning 30s on a
    // command that cannot possibly be delivered.
    const status = await termuxService.status();
    if (status.installed && !status.ready) {
      return {
        success: false,
        content: `Termux is installed but the bridge is not ready. ${status.hint}`,
        error: status.hint,
      };
    }

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
      // Includes the 30s timeout. Never hangs the tool loop.
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, content: '', error: message };
    }
  },
};

export const termuxTools: Tool[] = [termuxStatus, termuxRun];
