import { z } from 'zod';
import terminalService from '../TerminalService';
import SandboxService from '../SandboxService';
import CodeRunner from '../CodeRunner';
import type { Tool, ToolContext } from './types';

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    return i.message;
  }).join('; ');
}

/**
 * Prepare the shell command for the target language.
 * Uses $HOME instead of /tmp because Alpine proot on Android
 * may not have a writable /tmp — $HOME is always safe.
 */
function buildShellCommand(command: string, language: string): string {
  switch (language) {
    case 'python':
      return `python3 - << 'GIA_PYEOF'
${command}
GIA_PYEOF`;
    case 'js':
      return `node - << 'GIA_JSEOF'
${command}
GIA_JSEOF`;
    case 'cpp': {
      const safeId = `gia_cpp_${Date.now()}`;
      // Use $HOME not /tmp — /tmp may not exist in proot Alpine
      return [
        `_TMPDIR="$HOME/.gia_tmp" && mkdir -p "$_TMPDIR"`,
        `cat > "$_TMPDIR/${safeId}.cpp" << 'GIA_CPPEOF'`,
        command,
        'GIA_CPPEOF',
        `g++ -o "$_TMPDIR/${safeId}" "$_TMPDIR/${safeId}.cpp" -std=c++17 -O2 2>&1`,
        `&& "$_TMPDIR/${safeId}" 2>&1`,
        `; rm -f "$_TMPDIR/${safeId}.cpp" "$_TMPDIR/${safeId}"`,
      ].join('\n');
    }
    default:
      return command;
  }
}

const terminalRun: Tool = {
  id: 'terminal_run',
  name: 'terminal_run',
  description: 'Execute shell commands in GIA\'s proot+Alpine terminal environment. Supports Python, JavaScript, shell scripts, and any command available in Alpine Linux. Results are shown to the user as terminal output.',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command or code to execute in the terminal' },
      language: {
        type: 'string',
        enum: ['sh', 'python', 'js', 'cpp'],
        description: 'Language/execution mode. Use "python" for Python scripts, "js" for Node.js, "cpp" for compiled C++, "sh" (default) for shell commands.',
      },
      workdir: { type: 'string', description: 'Optional working directory inside the proot environment' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000, max: 300000)' },
    },
    required: ['command'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const schema = z.object({
      command: z.string().min(1, 'Command is required').max(10000),
      language: z.enum(['sh', 'python', 'js', 'cpp']).default('sh'),
      workdir: z.string().max(500).optional(),
      timeout: z.number().min(1000).max(300000).default(30000),
    });

    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    }

    const { command, language, workdir, timeout } = parsed.data;
    const shellCommand = buildShellCommand(command, language);
    const errors: string[] = [];

    // ── Backend 1: Native Capacitor plugin (Android proot+Alpine) ──────────
    ctx?.onProgress?.(0.1, 'Running in terminal…');
    try {
      const result = await terminalService.exec(shellCommand, workdir, undefined, timeout);

      // exitCode -1 + sessionId 'mock' = plugin not available (web fallback)
      if (!(result.exitCode === -1 && result.sessionId === 'mock')) {
        ctx?.onProgress?.(1, 'Done');
        const output = result.output?.trim() || '(no output)';
        const statusIcon = result.exitCode === 0 ? '✅' : '⚠️';
        return {
          success: result.exitCode === 0,
          content: `## ${statusIcon} Terminal Output

\`\`\`
${output.slice(0, 50000)}
\`\`\`

_Exit code: ${result.exitCode}_`,
          error: result.exitCode !== 0 ? `Process exited with code ${result.exitCode}` : undefined,
        };
      }
      errors.push('Native GIATerminal plugin: not available on this platform');
    } catch (e) {
      errors.push(`Native plugin error: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── Backend 2: Sandbox server (desktop dev, port 3081) ─────────────────
    ctx?.onProgress?.(0.35, 'Trying sandbox…');
    try {
      const available = await SandboxService.ensureAvailable();
      if (available) {
        const result = await SandboxService.exec(shellCommand, { timeout, workdir });
        ctx?.onProgress?.(1, 'Done');
        const parts: string[] = [];
        if (result.stdout) parts.push(result.stdout);
        if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
        if (result.exitCode !== 0) parts.push(`\nExit code: ${result.exitCode}`);
        return {
          success: result.exitCode === 0,
          content: parts.join('\n\n') || '(no output)',
          error: result.exitCode !== 0 ? `Exit code ${result.exitCode}` : undefined,
        };
      }
      errors.push('Sandbox server: not running on port 3081');
    } catch {
      errors.push('Sandbox server: connection failed');
    }

    // ── Backend 3: CodeRunner / Piston API ─────────────────────────────────
    ctx?.onProgress?.(0.6, 'Trying code runner…');
    try {
      // Map sh → python for Piston (bash support is inconsistent on free tier)
      const codeLang = language === 'sh' ? 'python' : language;
      const result = await CodeRunner.run({ language: codeLang, code: command });
      ctx?.onProgress?.(1, 'Done');
      if (result.error && !result.output) {
        errors.push(`Code runner: ${result.error}`);
      } else {
        return {
          success: !result.error,
          content: result.output || '(no output)',
          error: result.error || undefined,
        };
      }
    } catch (e) {
      errors.push(`Code runner: ${e instanceof Error ? e.message : 'failed'}`);
    }

    // ── All backends exhausted ──────────────────────────────────────────────
    // Give the user an honest, actionable error instead of letting the AI hallucinate success.
    const detail = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
    return {
      success: false,
      content: '',
      error: [
        'All terminal backends are unavailable right now.',
        '',
        'What was tried:',
        detail,
        '',
        'To fix:',
        '• On Android: ensure the GIATerminal native plugin is installed and the proot Alpine environment is set up.',
        '• For code execution: configure a Piston endpoint in Settings → Code Execution.',
      ].join('\n'),
    };
  },
};

const terminalStatus: Tool = {
  id: 'terminal_status',
  name: 'terminal_status',
  description: 'Check if the proot+Alpine terminal is running and get session statistics.',
  execute: async () => {
    try {
      const status = await terminalService.getStatus();
      const sessions = await terminalService.listSessions();
      const fsInfo = await terminalService.getFSInfo();
      const usedGB = (fsInfo.usedBytes / 1073741824).toFixed(1);
      const freeGB = (fsInfo.freeBytes / 1073741824).toFixed(1);
      const totalGB = (fsInfo.totalBytes / 1073741824).toFixed(1);

      return {
        success: true,
        content: [
          '## 🖥️ Terminal Status',
          '',
          `**Running:** ${status.running ? '✅ Yes' : '❌ No'}`,
          `**Active Sessions:** ${status.sessionCount}`,
          '',
          '**Filesystem:**',
          `- Total: ${totalGB} GB`,
          `- Used: ${usedGB} GB`,
          `- Free: ${freeGB} GB`,
          '',
          sessions.length > 0
            ? `**Sessions:**\n${sessions.map(s => `- \`${s.sessionId}\`: ${s.command.slice(0, 80)}${s.running ? ' _(running)_' : ''}`).join('\n')}`
            : '_No active sessions._',
        ].join('\n'),
      };
    } catch (e: unknown) {
      return {
        success: false,
        content: '',
        error: `Terminal not available: ${e instanceof Error ? e.message : 'unknown error'}`,
      };
    }
  },
};

const terminalKill: Tool = {
  id: 'terminal_kill',
  name: 'terminal_kill',
  description: 'Kill a running terminal session by its session ID.',
  schema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Session ID to kill' },
    },
    required: ['sessionId'],
  },
  execute: async (args) => {
    const schema = z.object({ sessionId: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    }
    try {
      await terminalService.kill(parsed.data.sessionId);
      return { success: true, content: `🔪 Session \`${parsed.data.sessionId}\` killed.` };
    } catch (e: unknown) {
      return {
        success: false,
        content: '',
        error: `Failed to kill session: ${e instanceof Error ? e.message : 'unknown error'}`,
      };
    }
  },
};

export const terminalTools: Tool[] = [
  terminalRun,
  terminalStatus,
  terminalKill,
];
