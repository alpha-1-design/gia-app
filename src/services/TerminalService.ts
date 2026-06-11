/**
 * TerminalService - TypeScript abstraction over the GIATerminal Capacitor plugin.
 *
 * Provides exec, kill, listSessions, getFSInfo, and getStatus methods
 * that bridge to the native GIATerminalPlugin for proot+Alpine terminal sessions.
 *
 * Includes a web fallback that logs a warning instead of crashing.
 */

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
function getPlugin(): any {
  try {
    const { Capacitor } = require('@capacitor/core');
    if (Capacitor.isPluginAvailable('GIATerminal')) {
      return Capacitor.Plugins.GIATerminal;
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

class TerminalService {
  private plugin: any;

  constructor() {
    this.plugin = getPlugin();
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
      const result = await this.plugin.exec({
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
    } catch (error: any) {
      console.error('[TerminalService] exec() failed:', error);
      throw new Error(`Terminal exec failed: ${error.message ?? error}`);
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
      await this.plugin.kill({ sessionId });
    } catch (error: any) {
      console.error('[TerminalService] kill() failed:', error);
      throw new Error(`Terminal kill failed: ${error.message ?? error}`);
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
      const result = await this.plugin.listSessions();
      return (result.sessions ?? []) as SessionInfo[];
    } catch (error: any) {
      console.error('[TerminalService] listSessions() failed:', error);
      throw new Error(`Terminal listSessions failed: ${error.message ?? error}`);
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
      const result = await this.plugin.getFSInfo();
      return {
        totalBytes: result.totalBytes ?? 0,
        freeBytes: result.freeBytes ?? 0,
        usedBytes: result.usedBytes ?? 0,
      };
    } catch (error: any) {
      console.error('[TerminalService] getFSInfo() failed:', error);
      throw new Error(`Terminal getFSInfo failed: ${error.message ?? error}`);
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
      const result = await this.plugin.getStatus();
      return {
        running: result.running ?? false,
        sessionCount: result.sessionCount ?? 0,
      };
    } catch (error: any) {
      console.error('[TerminalService] getStatus() failed:', error);
      throw new Error(`Terminal getStatus failed: ${error.message ?? error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const terminalService = new TerminalService();
export default terminalService;
