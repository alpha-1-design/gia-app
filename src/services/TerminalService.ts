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
    if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('GIATerminal')) {
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
  kill(opts: { sessionId: string }): Promise<void>;
  listSessions(): Promise<{ sessions: SessionInfo[] }>;
  getFSInfo(): Promise<{ totalBytes: number; freeBytes: number; usedBytes: number }>;
  getStatus(): Promise<{ running: boolean; sessionCount: number }>;
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

    try {
      const result = await this.p.exec({
        command,
        workdir: workdir || '',
        env: env || {},
        timeout: timeout || 30000,
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
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const terminalService = new TerminalService();
export default terminalService;
