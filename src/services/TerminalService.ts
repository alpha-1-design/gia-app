/**
 * TerminalService - TypeScript abstraction over the GIATerminal Capacitor plugin.
 *
 * Provides exec, kill, listSessions, getFSInfo, and getStatus methods
 * that bridge to the native GIATerminalPlugin for proot+Alpine terminal sessions.
 *
 * Includes a web fallback that logs a warning instead of crashing.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecResult {
  output: string;
  exitCode: number;
  sessionId: string;
}

export interface SessionInfo {
  sessionId: string;
  command: string;
  createdAt: number;
  running: boolean;
}

export interface FSInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export interface StatusInfo {
  running: boolean;
  sessionCount: number;
}

// ---------------------------------------------------------------------------
// Capacitor plugin accessor
// ---------------------------------------------------------------------------

/**
 * Resolve the GIATerminal plugin from Capacitor's plugin registry.
 * Returns null on web or if the plugin is not registered.
 */
function getPlugin(): unknown {
  try {
    const isNative = typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
    const isAvailable = typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('GIATerminal');
    if (isNative || isAvailable) {
      return registerPlugin('GIATerminal');
    }
    console.warn('[TerminalService] GIATerminal plugin not available');
    return null;
  } catch {
    console.warn('[TerminalService] @capacitor/core not available (likely web)');
    return null;
  }
}

// ---------------------------------------------------------------------------
// TerminalService
// ---------------------------------------------------------------------------

interface GiaTerminalPlugin {
  exec(opts: { command: string; workdir: string; env: Record<string, string>; timeout: number }): Promise<{ output: string; exitCode: number; sessionId: string }>;
  spawn(opts: { command: string; workdir: string }): Promise<{ sessionId: string; command: string; running: boolean }>;
  readOutput(opts: { sessionId: string }): Promise<{ output: string; running: boolean; gone: boolean; exitCode: number }>;
  kill(opts: { sessionId: string }): Promise<void>;
  listSessions(): Promise<{ sessions: SessionInfo[] }>;
  getFSInfo(): Promise<{ totalBytes: number; freeBytes: number; usedBytes: number }>;
  getStatus(): Promise<{ running: boolean; sessionCount: number }>;
  reinstallRootfs(): Promise<{ success: boolean; message: string }>;
}

export function getSmartTimeout(command: string, requestedTimeout?: number): number {
  const cmd = command.toLowerCase();
  // Dev servers / long-running foreground processes that never exit on
  // their own (npm run dev, npm start, vite, next dev, flask run, python
  // -m http.server, etc). Checked first and unconditionally -- even if an
  // explicit requestedTimeout was passed, a foreground long-running server
  // is structurally wrong regardless of how long you wait for it (it will
  // never return control on its own), so no requested timeout value should
  // be allowed to bypass the fast-fail here. These should always be run
  // backgrounded instead (see BUILD mode's system prompt).
  if (/(npm\s+(run\s+dev|start)|yarn\s+(dev|start)|pnpm\s+(dev|start)|^vite(\s|$)|next\s+dev|flask\s+run|python3?\s+-m\s+http\.server|uvicorn|gunicorn|rails\s+server|php\s+-S)/.test(cmd)) {
    return 10000; // 10 seconds
  }
  if (requestedTimeout && requestedTimeout > 30000 && requestedTimeout !== 60000) {
    return requestedTimeout;
  }
  // Package installation / dependency downloads
  if (/(npm\s+(install|ci|i|add)|yarn\s+(install|add)|pnpm\s+(install|add)|pip3?\s+install|apt-get\s+install|apk\s+add|cargo\s+(install|build)|go\s+get|composer\s+install)/.test(cmd)) {
    return 300000; // 5 minutes
  }
  // Heavy builds & compilations
  if (/(npm\s+run\s+build|vite\s+build|tsc|g\+\+|gcc|make|cmake|gradle|docker\s+build|npx\s+cap\s+sync)/.test(cmd)) {
    return 240000; // 4 minutes
  }
  // Git clones / network downloads
  if (/(git\s+clone|wget|curl|git\s+fetch|git\s+pull)/.test(cmd)) {
    return 180000; // 3 minutes
  }
  // Tests / python scripts / node runs
  if (/(pytest|vitest|npm\s+test|python3?|node)/.test(cmd)) {
    return 120000; // 2 minutes
  }
  return requestedTimeout || 60000; // 1 minute default for simple commands
}

class TerminalService {
  private plugin: unknown;

  constructor() {
    this.plugin = getPlugin();
  }

  private get p(): GiaTerminalPlugin {
    return this.plugin as GiaTerminalPlugin;
  }

  /** True when the native GIATerminal plugin (on-device Alpine sandbox) is reachable. */
  isAvailable(): boolean {
    return !!this.plugin;
  }

  /**
   * Execute a command inside a proot+Alpine terminal session.
   *
   * @param command  Shell command(s) to execute
   * @param workdir  Optional working directory inside the proot environment
   * @param env      Optional environment variables (key-value pairs)
   * @param timeout  Optional timeout in milliseconds (default: 30000)
   * @returns        Promise resolving to {output, exitCode, sessionId}
   */
  async exec(
    command: string,
    workdir?: string,
    env?: Record<string, string>,
    timeout?: number,
  ): Promise<ExecResult> {
    if (!this.plugin) {
      console.warn('[TerminalService] exec() called but plugin unavailable', {
        command,
        workdir,
        timeout,
      });
      return {
        output: '[TerminalService] GIATerminal plugin not available on this platform',
        exitCode: -1,
        sessionId: 'mock',
      };
    }

    const effectiveTimeout = getSmartTimeout(command, timeout);
    try {
      const result = await this.p.exec({
        command,
        workdir: workdir || '',
        env: env || {},
        timeout: effectiveTimeout,
      });
      return {
        output: result.output ?? '',
        exitCode: result.exitCode ?? -1,
        sessionId: result.sessionId ?? '',
      };
    } catch (error) {
      console.error('[TerminalService] exec() failed:', error);
      throw new Error(`Terminal exec failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start a command in the background (run-detached). The session stays alive
   * in the native service until explicitly killed or the process exits —
   * unlike exec(), which awaits completion and reaps the session. Poll with
   * readOutput() and stop with kill().
   *
   * @param command  Shell command(s) to run in the background
   * @param workdir  Optional working directory inside the proot environment
   * @returns        Promise resolving to { sessionId, command, running }
   */
  async spawn(command: string, workdir?: string): Promise<{ sessionId: string; command: string; running: boolean }> {
    if (!this.plugin) {
      throw new Error('Terminal spawn requires the native GIATerminal plugin (Android only)');
    }
    try {
      return await this.p.spawn({ command, workdir: workdir || '' });
    } catch (error) {
      console.error('[TerminalService] spawn() failed:', error);
      throw new Error(`Terminal spawn failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read (and drain) the output a background session has produced so far.
   * Non-blocking — returns whatever is buffered since the last read.
   *
   * @param sessionId  ID of the background session
   * @returns          { output, running, gone, exitCode }
   */
  async readOutput(sessionId: string): Promise<{ output: string; running: boolean; gone: boolean; exitCode: number }> {
    if (!this.plugin) {
      throw new Error('Terminal readOutput requires the native GIATerminal plugin (Android only)');
    }
    try {
      const r = await this.p.readOutput({ sessionId });
      return {
        output: r.output ?? '',
        running: r.running ?? false,
        gone: r.gone ?? false,
        exitCode: r.exitCode ?? -1,
      };
    } catch (error) {
      console.error('[TerminalService] readOutput() failed:', error);
      throw new Error(`Terminal readOutput failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Kill a terminal session by session ID.
   *
   * @param sessionId  ID of the session to kill
   */
  async kill(sessionId: string): Promise<void> {
    if (!this.plugin) {
      console.warn('[TerminalService] kill() called but plugin unavailable');
      return;
    }

    try {
      await this.p.kill({ sessionId });
    } catch (error) {
      console.error('[TerminalService] kill() failed:', error);
      throw new Error(`Terminal kill failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all active terminal sessions.
   *
   * @returns Array of session info objects
   */
  async listSessions(): Promise<SessionInfo[]> {
    if (!this.plugin) {
      console.warn('[TerminalService] listSessions() called but plugin unavailable');
      return [];
    }

    try {
      const result = await this.p.listSessions();
      return (result.sessions ?? []) as SessionInfo[];
    } catch (error) {
      console.error('[TerminalService] listSessions() failed:', error);
      throw new Error(`Terminal listSessions failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get filesystem info for the terminal data directory.
   *
   * @returns {totalBytes, freeBytes, usedBytes}
   */
  async getFSInfo(): Promise<FSInfo> {
    if (!this.plugin) {
      console.warn('[TerminalService] getFSInfo() called but plugin unavailable');
      return { totalBytes: 0, freeBytes: 0, usedBytes: 0 };
    }

    try {
      const result = await this.p.getFSInfo();
      return {
        totalBytes: result.totalBytes ?? 0,
        freeBytes: result.freeBytes ?? 0,
        usedBytes: result.usedBytes ?? 0,
      };
    } catch (error) {
      console.error('[TerminalService] getFSInfo() failed:', error);
      throw new Error(`Terminal getFSInfo failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the terminal service status.
   *
   * @returns {running, sessionCount}
   */
  async getStatus(): Promise<StatusInfo> {
    if (!this.plugin) {
      console.warn('[TerminalService] getStatus() called but plugin unavailable');
      return { running: false, sessionCount: 0 };
    }

    try {
      const result = await this.p.getStatus();
      return {
        running: result.running ?? false,
        sessionCount: result.sessionCount ?? 0,
      };
    } catch (error) {
      console.error('[TerminalService] getStatus() failed:', error);
      throw new Error(`Terminal getStatus failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Force-delete the rootfs and re-extract from APK assets.
   *
   * This is the escape hatch for when the rootfs is broken (e.g. old
   * extraction created non-functional symlinks). After this, the next
   * exec() call will wait for extraction and use the fresh rootfs.
   */
  async reinstallRootfs(): Promise<{ success: boolean; message: string }> {
    if (!this.plugin) {
      throw new Error('Terminal plugin not available — cannot reinstall rootfs');
    }
    try {
      const result = await (this.p as GiaTerminalPlugin).reinstallRootfs();
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('[TerminalService] reinstallRootfs() failed:', error);
      throw new Error(`Rootfs reinstall failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const terminalService = new TerminalService();
export default terminalService;
