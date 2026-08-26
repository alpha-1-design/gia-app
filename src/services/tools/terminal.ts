import { z } from 'zod';
import terminalService, { getSmartTimeout } from '../TerminalService';
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

function normalizeLanguage(val: unknown): 'sh' | 'python' | 'js' | 'cpp' {
  if (typeof val !== 'string' || !val.trim()) return 'sh';
  const l = val.toLowerCase().trim();
  if (['python', 'python3', 'py', 'python2'].includes(l)) return 'python';
  if (['js', 'javascript', 'node', 'nodejs', 'ts', 'typescript'].includes(l)) return 'js';
  if (['cpp', 'c++', 'c', 'cplusplus'].includes(l)) return 'cpp';
  return 'sh';
}

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return {};
  const obj = { ...(raw as Record<string, unknown>) };
  if ((!obj.command || typeof obj.command !== 'string') && typeof obj.code === 'string') {
    obj.command = obj.code;
  }
  return obj;
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
        description: 'Language/execution mode. Use "python" for Python scripts, "js" for Node.js, "cpp" for compiled C++, "sh" (default) for shell/bash commands.',
      },
      workdir: { type: 'string', description: 'Optional working directory inside the proot environment' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000, max: 300000)' },
    },
    required: ['command'],
  },
  execute: async (args, ctx?: ToolContext) => {
    const preparedArgs = normalizeArgs(args);
    const schema = z.object({
      command: z.string().min(1, 'Command is required').max(10000),
      language: z.preprocess(normalizeLanguage, z.enum(['sh', 'python', 'js', 'cpp'])).default('sh'),
      workdir: z.string().max(500).optional(),
      timeout: z.number().min(1000).max(300000).default(30000),
    });

    const parsed = schema.safeParse(preparedArgs);
    if (!parsed.success) {
      return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    }

    const { command, language, workdir, timeout } = parsed.data;
    const effectiveTimeout = getSmartTimeout(command, timeout);
    const shellCommand = buildShellCommand(command, language);
    const errors: string[] = [];

    // ── Backend 1: Native Capacitor plugin (Android proot+Alpine) ──────────
    ctx?.onProgress?.(0.1, 'Running in terminal…');
    ctx?.onThought?.(`💻 Running: ${shellCommand.slice(0, 80)}...`);
    try {
      const result = await terminalService.exec(shellCommand, workdir, undefined, effectiveTimeout);

      // exitCode -1 + sessionId 'mock' = plugin not available (web fallback)
      if (!(result.exitCode === -1 && result.sessionId === 'mock')) {
        ctx?.onProgress?.(1, 'Done');
        const output = result.output?.trim() || '(no output)';
        const statusIcon = result.exitCode === 0 ? '✅' : '⚠️';
        ctx?.onThought?.(statusIcon === '✅' ? 'Command completed' : `Command exited with code ${result.exitCode}`);
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
    ctx?.onThought?.('Trying sandbox execution...');
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
    ctx?.onThought?.('Falling back to code runner API...');
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

    // ── Backend 4: Browser-native JS sandbox ────────────────────────────────
    if (language === 'js') {
      ctx?.onProgress?.(0.8, 'Running in browser…');
      ctx?.onThought?.('Running JavaScript in browser sandbox...');
      try {
        const result = await CodeRunner.run({ language: 'javascript', code: command });
        if (!result.error || result.output) {
          ctx?.onProgress?.(1, 'Done');
          return { success: !result.error, content: result.output || '(no output)', error: result.error || undefined };
        }
        errors.push(`Browser JS: ${result.error}`);
      } catch (e) {
        errors.push(`Browser JS: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    // ── Backend 5: Pyodide WASM Python (local, no server needed) ───────────
    if (language === 'python') {
      ctx?.onProgress?.(0.8, 'Loading Python runtime…');
      ctx?.onThought?.('Loading Pyodide (WASM Python)...');
      try {
        const pyodideMod = await import('../PyodideRunner');
        // PyodideRunner loads the WASM runtime on first use and captures
        // stdout/stderr properly. (The old path checked isReady() but never
        // called loadPyodide(), which is why this backend always reported
        // "Pyodide: runtime not loaded".)
        const { output, error } = await pyodideMod.runPython(command, ctx);
        ctx?.onProgress?.(1, 'Done');
        if (!error) {
          return { success: true, content: output || '(no output)', error: undefined };
        }
        errors.push(`Pyodide: ${error}`);
      } catch (e) {
        errors.push(`Pyodide: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    // ── All backends exhausted ──────────────────────────────────────────────
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
        '• JavaScript runs in-browser automatically.',
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

const terminalBackground: Tool = {
  id: 'terminal_background',
  name: 'terminal_background',
  description: 'Run a long-lived command in the background and manage it. Actions: start (launch a dev server / watcher / download detached from the request so it keeps running after this tool returns), log (read the output a background session has produced so far — non-blocking), stop (kill a background session by its sessionId).',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'log', 'stop'],
        description: 'start = launch in background, log = read buffered output, stop = kill the session',
      },
      command: { type: 'string', description: 'Command to run in the background (required for action=start)' },
      sessionId: { type: 'string', description: 'Session id returned by start (required for action=log and action=stop)' },
    },
    required: ['action'],
  },
  execute: async (args) => {
    const action = String(args.action || '');

    if (action === 'start') {
      const command = String(args.command || '').trim();
      if (!command) {
        return { success: false, content: '', error: 'command is required for action=start' };
      }

      // Backend 1: native on-device proot session (Android) — run-detached,
      // stays alive in the service until killed or the process exits.
      if (terminalService.isAvailable()) {
        try {
          const { sessionId, running } = await terminalService.spawn(command);
          return {
            success: true,
            content: [
              '## 🔄 Background started (on-device)',
              '',
              '```',
              command.slice(0, 500),
              '```',
              '',
              `**Session:** \`${sessionId}\``,
              `**Status:** ${running ? 'running' : 'exited immediately'}`,
              '',
              `Poll output with \`terminal_background\` action=\`log\`, sessionId=\`${sessionId}\`.`,
              `Stop it with action=\`stop\`.`,  
            ].join('\n'),
          };
        } catch (e) {
          return { success: false, content: '', error: `Background start failed: ${e instanceof Error ? e.message : String(e)}` };
        }
      }

      // Backend 2: desktop/browser — detach via setsid+nohup through the
      // sandbox so the process outlives this request. Best-effort: depends on
      // the sandbox server not reaping process groups.
      try {
        const available = await SandboxService.ensureAvailable();
        if (!available) {
          return {
            success: false,
            content: '',
            error: 'Background execution needs the on-device terminal (Android) or the sandbox server (desktop). Neither is available.',
          };
        }
        const logPath = `/tmp/gia-bg-${Date.now()}.log`;
        const pidPath = `/tmp/gia-bg-${Date.now()}.pid`;
        const wrapped = [
          `setsid nohup sh -c ${JSON.stringify(command)} > ${logPath} 2>&1 < /dev/null &`,
          `echo $! > ${pidPath}`,
          `sleep 0.5; cat ${pidPath}`,  
        ].join(' ');
        const res = await SandboxService.exec(wrapped, { timeout: 15000 });
        const pid = res.stdout.trim().split('\n').pop()?.trim();
        return {
          success: true,
          content: [
            '## 🔄 Background started (sandbox)',
            '',
            `**PID:** ${pid || 'unknown'}`,
            `**Log:** \`${logPath}\``,
            '',
            `Poll with action=\`log\`, sessionId=\`file://${pidPath}\`; stop with action=\`stop\`.`,
          ].join('\n'),
        };
      } catch (e) {
        return { success: false, content: '', error: `Background start failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    if (action === 'log') {
      const sessionId = String(args.sessionId || '').trim();
      if (!sessionId) {
        return { success: false, content: '', error: 'sessionId is required for action=log' };
      }

      // Sandbox fallback session — read the log file the process writes to.
      if (sessionId.startsWith('file://')) {
        const pidPath = sessionId.replace('file://', '');
        const logPath = pidPath.replace(/\.pid$/, '.log');
        try {
          const available = await SandboxService.ensureAvailable();
          if (!available) return { success: false, content: '', error: 'Sandbox not available' };
          const res = await SandboxService.exec(
            `if [ -f ${pidPath} ] && kill -0 $(cat ${pidPath}) 2>/dev/null; then echo "RUNNING"; else echo "STOPPED"; fi; echo "---"; cat ${logPath} 2>/dev/null || echo "(no output yet)"`,
            { timeout: 15000 },
          );
          const stopped = res.stdout.includes('STOPPED');
          const body = res.stdout.replace('RUNNING', '').replace('STOPPED', '').replace('---', '').trim();
          return {
            success: true,
            content: `## 📡 Background log${stopped ? ' (stopped)' : ''}\n\n\`\`\`\n${(body || '(no output yet)').slice(0, 20000)}\n\`\`\``,
          };
        } catch (e) {
          return { success: false, content: '', error: `Log read failed: ${e instanceof Error ? e.message : String(e)}` };
        }
      }

      try {
        const r = await terminalService.readOutput(sessionId);
        const status = r.gone ? 'finished' : r.running ? 'running' : 'exited';
        const header = r.gone
          ? `finished (exit ${r.exitCode})`
          : status === 'running' ? 'running' : 'exited';
        return {
          success: true,
          content: `## 📡 Background log (\`${sessionId}\` — ${header})\n\n\`\`\`\n${(r.output || '(no output yet)').slice(0, 20000)}\n\`\`\``,
        };
      } catch (e) {
        return { success: false, content: '', error: `Log read failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    if (action === 'stop') {
      const sessionId = String(args.sessionId || '').trim();
      if (!sessionId) {
        return { success: false, content: '', error: 'sessionId is required for action=stop' };
      }

      if (sessionId.startsWith('file://')) {
        const pidPath = sessionId.replace('file://', '');
        try {
          const available = await SandboxService.ensureAvailable();
          if (!available) return { success: false, content: '', error: 'Sandbox not available' };
          await SandboxService.exec(`kill $(cat ${pidPath} 2>/dev/null) 2>/dev/null; rm -f ${pidPath}; echo stopped`, { timeout: 10000 });
          return { success: true, content: `🔪 Background process stopped.` };
        } catch (e) {
          return { success: false, content: '', error: `Stop failed: ${e instanceof Error ? e.message : String(e)}` };
        }
      }

      try {
        await terminalService.kill(sessionId);
        return { success: true, content: `🔪 Background session \`${sessionId}\` stopped.` };
      } catch (e) {
        return { success: false, content: '', error: `Stop failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    return { success: false, content: '', error: `Unknown action: ${action} — use start, log, or stop.` };
  },
};

export const terminalTools: Tool[] = [
  terminalRun,
  terminalStatus,
  terminalKill,
  terminalBackground,
];
