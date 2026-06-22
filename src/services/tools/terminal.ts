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

const terminalRun: Tool = {
  id: 'terminal_run',
  name: 'terminal_run',
  description: 'Execute shell commands in GIA\'s proot+Alpine terminal environment. Supports Python, JavaScript, shell scripts, and any command available in Alpine Linux.',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command or code to execute in the terminal' },
      language: { type: 'string', enum: ['sh', 'python', 'js', 'cpp'], description: 'Language/execution mode. Use "python" for .py, "js" for Node.js, "cpp" for compiled C++, "sh" (default) for shell commands.' },
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
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { command, language, workdir, timeout } = parsed.data;

    // Transform based on language
    let shellCommand = command;
    if (language === 'python') {
      shellCommand = `python3 << 'GIA_EOF'\n${command}\nGIA_EOF`;
    } else if (language === 'js') {
      shellCommand = `node << 'GIA_EOF'\n${command}\nGIA_EOF`;
    } else if (language === 'cpp') {
      const safeId = `gia_cpp_${Date.now()}`;
      shellCommand = `cat > /tmp/${safeId}.cpp << 'GIA_EOF'\n${command}\nGIA_EOF\ng++ -o /tmp/${safeId} /tmp/${safeId}.cpp -std=c++17 -O2 2>&1 && /tmp/${safeId} 2>&1; rm -f /tmp/${safeId}.cpp /tmp/${safeId}`;
    }

    ctx?.onProgress?.(0.1, 'Attempting native terminal...');

    // Try backends in order: native plugin → sandbox server → code runner
    const errors: string[] = [];

    // 1. Try native Capacitor plugin (Android)
    try {
      const result = await terminalService.exec(shellCommand, workdir, undefined, timeout);
      if (result.exitCode !== -1 || result.sessionId !== 'mock') {
        ctx?.onProgress?.(1, 'Done');
        const output = result.output || '(no output)';
        const status = result.exitCode === 0 ? '✅' : '⚠️';
        return {
          success: true,
          content: `## ${status} Terminal Output\n\n\`\`\`\n${output.slice(0, 50000)}\n\`\`\`\n\n_Exit code: ${result.exitCode}_`,
        };
      }
      errors.push(`Native plugin: ${result.output}`);
    } catch { errors.push('Native plugin unavailable'); }

    // 2. Try Sandbox server (desktop dev, port 3081)
    ctx?.onProgress?.(0.3, 'Trying sandbox server...');
    try {
      const available = await SandboxService.ensureAvailable();
      if (available) {
        const result = await SandboxService.exec(shellCommand, { timeout, workdir });
        ctx?.onProgress?.(1, 'Done');
        const parts: string[] = [];
        if (result.stdout) parts.push(result.stdout);
        if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
        if (result.exitCode !== 0) parts.push(`\nExit code: ${result.exitCode}`);
        return { success: true, content: parts.join('\n\n') || '(no output)' };
      }
      errors.push('Sandbox server not running');
    } catch { errors.push('Sandbox server error'); }

    // 3. Fall back to CodeRunner (Piston API or local JS)
    ctx?.onProgress?.(0.5, 'Falling back to code runner...');
    try {
      const codeLang = language === 'sh' ? 'python' : language;
      const result = await CodeRunner.run({ language: codeLang, code: command });
      ctx?.onProgress?.(1, 'Done');
      if (result.error) {
        return { success: false, content: result.output, error: result.error };
      }
      return { success: true, content: result.output || '(no output)' };
    } catch (e) {
      errors.push(`Code runner: ${e instanceof Error ? e.message : 'failed'}`);
    }

    return {
      success: false,
      content: '',
      error: `All terminal backends failed:\n${errors.join('\n')}`,
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
        content: `## 🖥️ Terminal Status\n\n**Running:** ${status.running ? '✅ Yes' : '❌ No'}\n**Active Sessions:** ${status.sessionCount}\n\n**Filesystem:**\n- Total: ${totalGB} GB\n- Used: ${usedGB} GB\n- Free: ${freeGB} GB\n\n${sessions.length > 0 ? `**Sessions:**\n${sessions.map(s => `- \`${s.sessionId}\`: ${s.command.slice(0, 80)}${s.running ? ' (running)' : ''}`).join('\n')}` : ''}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Terminal not available' };
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
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    try {
      await terminalService.kill(parsed.data.sessionId);
      return { success: true, content: `🔪 Session \`${parsed.data.sessionId}\` killed.` };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to kill session' };
    }
  },
};

export const terminalTools: Tool[] = [
  terminalRun,
  terminalStatus,
  terminalKill,
];
