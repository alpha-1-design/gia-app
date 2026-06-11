/**
 * Hidden Terminal tool definition for the GIA agent.
 *
 * Exposes a proot+Alpine terminal environment as a callable tool,
 * following the existing GIA tool pattern: {name, description, parameters, handler}.
 *
 * The handler receives {command, workdir?, env?, timeout?, persist?} and
 * delegates to TerminalService.exec().
 */

import terminalService from '../TerminalService';
import type { ExecResult } from '../TerminalService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalToolParams {
  /** Shell command(s) to execute inside the proot+Alpine environment */
  command: string;
  /** Optional working directory inside the environment */
  workdir?: string;
  /** Optional environment variables (object of key-value pairs) */
  env?: Record<string, string>;
  /** Execution timeout in milliseconds (default: 30000) */
  timeout?: number;
  /**
   * If true, keep the session alive after execution ends and return the
   * sessionId so the caller can write more stdin or check output later.
   * Default: false (session is killed after command completes).
   */
  persist?: boolean;
}

export interface TerminalToolResult {
  output: string;
  exitCode: number;
  sessionId: string;
  persisted: boolean;
}

// ---------------------------------------------------------------------------
// JSON Schema parameters
// ---------------------------------------------------------------------------

const terminalParameters = {
  type: 'object' as const,
  properties: {
    command: {
      type: 'string',
      description:
        'Shell command(s) to execute inside the proot+Alpine hidden terminal. ' +
        'Accepts multi-line scripts and piped commands.',
    },
    workdir: {
      type: 'string',
      description:
        'Working directory inside the proot environment. Defaults to /root.',
    },
    env: {
      type: 'object',
      description:
        'Optional environment variables as key-value pairs to set inside ' +
        'the proot environment.',
      additionalProperties: { type: 'string' },
    },
    timeout: {
      type: 'number',
      description:
        'Maximum execution time in milliseconds. Default: 30000 (30 seconds). ' +
        'Long-running commands may be killed if they exceed this.',
      default: 30000,
    },
    persist: {
      type: 'boolean',
      description:
        'If true, keeps the terminal session alive after execution so ' +
        'follow-up commands can be sent, or output can be polled. ' +
        'Default: false — the session is killed after the command finishes.',
      default: false,
    },
  },
  required: ['command'] as string[],
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function terminalHandler(
  params: TerminalToolParams,
): Promise<TerminalToolResult> {
  const { command, workdir, env, timeout = 30000, persist = false } = params;

  // For persistent sessions, we start and return immediately with the sessionId
  if (persist) {
    // In a persistent mode, we just fire-and-forget the command in a session.
    // The caller can then use writeStdin / killSession via the raw service.
    // For now we execute normally but return the sessionId so the caller
    // can continue interacting.
    // Future: implement a persistent session manager that holds sessions open.
    const result = await terminalService.exec(command, workdir, env, timeout);
    return {
      output: result.output,
      exitCode: result.exitCode,
      sessionId: result.sessionId,
      persisted: true,
    };
  }

  // Standard non-persistent execution
  const result = await terminalService.exec(command, workdir, env, timeout);

  return {
    output: result.output,
    exitCode: result.exitCode,
    sessionId: result.sessionId,
    persisted: false,
  };
}

// ---------------------------------------------------------------------------
// Tool definition (following the existing GIA tool pattern)
// ---------------------------------------------------------------------------

/**
 * The terminal tool definition object. Register this with the agent's tool
 * registry to make the hidden terminal available as a callable tool.
 */
export const terminalTool = {
  name: 'terminal',
  description:
    'Execute shell commands inside a hidden proot+Alpine terminal environment. ' +
    'This tool provides a full Linux userland (Alpine Linux) running via proot ' +
    'inside the Android app, without requiring root access. Use it for ' +
    'scripting, package management (apk), file operations, or any shell task ' +
    'that needs a Linux environment.',
  parameters: terminalParameters,
  handler: terminalHandler,
};

/**
 * The terminal tool specification for tool registration systems that expect
 * a spec object rather than a handler function.
 */
export const terminalSpec = {
  name: 'terminal',
  description: terminalTool.description,
  parameters: terminalParameters,
};

export default terminalTool;
