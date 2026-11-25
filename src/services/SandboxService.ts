

import terminalService from './TerminalService';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxFileEntry {
  name: string;
  isDir: boolean;
  size: number;
  mode: string;
  /** Last-modified time in milliseconds since epoch, when the platform can
   *  provide it (`stat -c %Y`). Optional: the native busybox probe may not
   *  support it, and the remote server may not return it. */
  mtimeMs?: number;
}

const DEFAULT_SANDBOX_URL = typeof window !== 'undefined' && window.location?.origin
  ? '/api/sandbox'
  : 'http://localhost:3081';

export const PROJECTS_DIRECTORY = '/workspace/projects';

/**
 * Per-operation abort budgets. A single uniform 120s AbortSignal used to cut
 * off `npm install`-sized work while still letting a hung health check block
 * the UI for two minutes — budgets now match how long each operation can
 * actually take.
 */
export const SANDBOX_BUDGETS = {
  health: 10_000,
  list: 30_000,
  fs: 120_000,
  exec: 300_000,
  /** Clone / package installs: builds and dependency pulls are slow. */
  long: 600_000,
} as const;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function workspacePath(path: string | undefined): string {
  if (!path || path === '.') return '/workspace';
  const normalized = path.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) throw new Error('Workspace paths cannot traverse parent directories.');
  if (normalized.startsWith('/')) return normalized;
  return `/workspace/${normalized.replace(/^\/+/, '')}`;
}

function repositoryName(repo: string): string {
  const name = repo.replace(/\/+$/, '').split(/[/:]/).pop()?.replace(/\.git$/i, '');
  if (!name || !/^[A-Za-z0-9_.-]+$/.test(name) || name === '.' || name === '..') {
    throw new Error('Could not determine a safe project folder name from that repository URL.');
  }
  return name;
}

/** Parent directory of a sandbox path, or '' when there is no parent. */
function sandboxParent(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return '';
  return path.slice(0, idx);
}

/** UTF-8-safe Base64 (TextEncoder → binary string → btoa). Equivalent to the
 *  old `btoa(unescape(encodeURIComponent(...)))` trick without the deprecated
 *  `unescape`. */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const CHUNK = 0x8000; // 32768 bytes — below every engine's spread/apply limit.
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

/** Errors that look like the on-device terminal session died underneath us
 *  (proot session torn down, plugin reloaded/re-initialized, "no active
 *  session", …). Deliberately narrow: broad matches would turn ordinary
 *  command failures (e.g. a path containing the word "session") into
 *  command re-execution, which has side effects. */
function looksLikeSessionLost(message: string): boolean {
  return /no (active )?session|session (lost|expired|closed|ended)|GIATerminal plugin (not available|unavailable)|terminal (unavailable|not available|lost|closed)|plugin not initialized|sandbox session was lost/i.test(message);
}

class SandboxService {
  private baseUrl: string = DEFAULT_SANDBOX_URL;
  private _available: boolean | null = null;
  private healthCheckPromise: Promise<boolean> | null = null;
  /** True once we've fallen back to the on-device native terminal because the
   *  remote sandbox-server.cjs companion process isn't reachable. Most people
   *  running GIA as a phone-only app were never going to have that companion
   *  server running, so every sandbox-dependent tool (file generation,
   *  document reading, builds, DB work, security scans, SSH, network utils)
   *  used to just hard-fail for them. The native GIATerminal plugin — the
   *  same on-device Alpine/proot sandbox the terminal tool uses — covers the
   *  same core need (running a shell command) without any companion process. */
  private usingNativeFallback = false;

  setBaseUrl(url: string) { this.baseUrl = url.replace(/\/+$/, ''); }
  getBaseUrl() { return this.baseUrl; }
  isUsingNativeFallback(): boolean { return this.usingNativeFallback; }

  private async request(path: string, options: RequestInit, budgetMs: number): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
        signal: AbortSignal.timeout(budgetMs),
      });
    } catch (error) {
      // AbortSignal.timeout rejects with a TimeoutError DOMException; translate
      // it so callers (and the person reading the error) see a real duration.
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new Error(`Sandbox request to ${path} timed out after ${Math.round(budgetMs / 1000)}s.`);
      }
      throw error;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Sandbox error ${res.status}: ${body || res.statusText}`);
    }
    return res;
  }

  private async postJSON(path: string, body: unknown, budgetMs: number): Promise<unknown> {
    const res = await this.request(path, { method: 'POST', body: JSON.stringify(body) }, budgetMs);
    return res.json();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.request('/health', { method: 'GET' }, SANDBOX_BUDGETS.health);
      const data = await res.json() as { ok: boolean };
      this._available = data.ok;
      if (data.ok) this.usingNativeFallback = false;
      return data.ok;
    } catch {
      this._available = false;
      return false;
    }
  }

  async ensureAvailable(): Promise<boolean> {
    if (this._available === true) return true;
    if (this.healthCheckPromise) return this.healthCheckPromise;
    this.healthCheckPromise = this.checkHealth().finally(() => { this.healthCheckPromise = null; });
    const remoteOk = await this.healthCheckPromise;
    if (remoteOk) return true;

    if (terminalService.isAvailable()) {
      this.usingNativeFallback = true;
      return true;
    }
    return false;
  }

  get available(): boolean | null { return this._available; }

  /**
   * Wedge recovery for the native fallback: if the on-device terminal session
   * was lost (device slept, proot killed, plugin reloaded), every call used to
   * fail forever until the panel was reopened. Now: detect session-lost
   * failures, re-verify availability once (remote server may be back, or the
   * terminal plugin may have re-initialized), retry the command once, and only
   * then fail with a message that says what actually happened.
   */
  private async nativeExecWithRecovery(command: string, workdir: string, timeoutMs?: number, env?: Record<string, string>): Promise<{ output: string; exitCode: number }> {
    const run = () => terminalService.exec(command, workdir, env, timeoutMs);
    let result: { output: string; exitCode: number };
    try {
      result = await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!looksLikeSessionLost(message)) throw error;
      if (!await this.recoverNativeFallback()) {
        throw new Error(`The sandbox session appears to have been lost and could not be recovered. Reopen the terminal or run Full Install in Settings, then try again. (Original error: ${message})`);
      }
      try {
        return await run();
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(`The sandbox session was lost and the retry after recovery also failed: ${retryMessage}`);
      }
    }
    // Some session deaths surface as a non-zero exit with a telltale message
    // instead of a thrown error — recover + retry once for those too.
    if (result.exitCode !== 0 && looksLikeSessionLost(result.output)) {
      if (await this.recoverNativeFallback()) {
        return run();
      }
    }
    return result;
  }

  /** Re-verify what's actually available right now. Returns true when either
   *  transport is usable; clears or re-arms the native fallback accordingly. */
  private async recoverNativeFallback(): Promise<boolean> {
    this.usingNativeFallback = false;
    this._available = null;
    const remoteOk = await this.checkHealth();
    if (remoteOk) return true;
    if (terminalService.isAvailable()) {
      this.usingNativeFallback = true;
      return true;
    }
    return false;
  }

  async exec(command: string, options?: { timeout?: number; workdir?: string; env?: Record<string, string> }): Promise<SandboxResult> {
    if (!this.usingNativeFallback) {
      const available = await this.ensureAvailable();
      if (!available) {
        throw new Error('Sandbox is unavailable: start the desktop sandbox server or set up the native terminal.');
      }
    }
    if (this.usingNativeFallback) {
      const result = await this.nativeExecWithRecovery(command, workspacePath(options?.workdir), options?.timeout, options?.env);
      return { stdout: result.output, stderr: '', exitCode: result.exitCode };
    }
    // Give the HTTP request a little more headroom than the command's own
    // server-side timeout so the server gets to report a clean timeout.
    const budget = Math.max(SANDBOX_BUDGETS.exec, (options?.timeout ?? 0) + 5_000);
    const data = await this.postJSON('/exec', { command, timeout: options?.timeout, workdir: workspacePath(options?.workdir) }, budget) as SandboxResult;
    return data;
  }

  async install(packages: string | string[]): Promise<SandboxResult> {
    const pkgList = Array.isArray(packages) ? packages : [packages];
    if (this.usingNativeFallback) {
      return this.exec(`apk add --no-cache ${pkgList.join(' ')}`, { timeout: SANDBOX_BUDGETS.long });
    }
    const data = await this.postJSON('/install', { packages: pkgList }, SANDBOX_BUDGETS.long) as SandboxResult;
    return data;
  }

  async clone(repo: string, dest?: string, token?: string): Promise<SandboxResult> {
    if (!/^https?:\/\/[^\s;&|`$]+$|^git@[A-Za-z0-9_.-]+:[^\s;&|`$]+$|^ssh:\/\/git@[A-Za-z0-9_.-]+\/[^\s;&|`$]+$/.test(repo)) {
      throw new Error('Repository must be a valid HTTPS or SSH Git URL.');
    }
    const projectName = dest || repositoryName(repo);
    if (!/^[A-Za-z0-9_.-]+$/.test(projectName) || projectName === '.' || projectName === '..') {
      throw new Error('Project folder name must contain only letters, numbers, dots, dashes, or underscores.');
    }
    const cloneUrl = repo.startsWith('git@github.com:')
      ? `https://github.com/${repo.slice('git@github.com:'.length)}`
      : repo.startsWith('ssh://git@github.com/')
        ? `https://github.com/${repo.slice('ssh://git@github.com/'.length)}`
        : repo;
    const isGitHub = /^https:\/\/github\.com\//i.test(cloneUrl);
    if (token && (token.length > 500 || /[\r\n]/.test(token))) throw new Error('GitHub token is malformed.');
    const gitEnv = token && isGitHub ? {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${btoa(`x-access-token:${token}`)}`,
    } : undefined;

    if (this.usingNativeFallback) {
      return this.exec(`mkdir -p ${shellQuote(PROJECTS_DIRECTORY)} && GIT_ASKPASS= GIT_TERMINAL_PROMPT=0 git clone --depth 1 ${shellQuote(cloneUrl)} ${shellQuote(`${PROJECTS_DIRECTORY}/${projectName}`)}`, { workdir: '/workspace', env: gitEnv, timeout: SANDBOX_BUDGETS.long });
    }
    const data = await this.postJSON('/clone', { repo: cloneUrl, dest: projectName, token: gitEnv ? token : undefined }, SANDBOX_BUDGETS.long) as SandboxResult;
    return data;
  }

  async readFile(path: string): Promise<string> {
    if (this.usingNativeFallback) {
      const result = await this.nativeExecWithRecovery(`cat -- ${shellQuote(workspacePath(path))}`, '/workspace', SANDBOX_BUDGETS.fs);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to read ${path}`);
      return result.output;
    }
    const res = await this.request(`/fs/read?path=${encodeURIComponent(path)}`, { method: 'GET' }, SANDBOX_BUDGETS.fs);
    const data = await res.json() as { content: string };
    return data.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.usingNativeFallback) {
      // On-device rootfs has no /workspace until the Full Install button
      // created it (SandboxSetupPanel mkdirs it explicitly — busybox ash
      // silently no-ops brace expansion, so a bare `mkdir -p /workspace`
      // even in our own writeFile would be fine but the audit calls this
      // gap out directly). mkdir the parent dir first so nested writes and
      // /workspace/<file> tool paths work on a fresh rootfs, mirroring the
      // remote server's auto-provisioning at sandbox-server.cjs:338.
      const target = workspacePath(path);
      const parent = sandboxParent(target);
      const mkdir = parent ? `mkdir -p -- ${shellQuote(parent)} && ` : '';
      // Base64 round-trip avoids any quoting/escaping issues with the shell
      // heredoc. The write is chunked into ~1MB pieces (first chunk `>`, the
      // rest `>>`) because a single giant argv — multi-MB file in one `echo`
      // — blows past the shell/executor argument limit and fails opaquely.
      // Chunk boundaries are multiples of 4 base64 chars, so concatenated
      // decodes reconstruct the exact bytes.
      const b64 = utf8ToBase64(content);
      const rawChunkSize = 1024 * 1024;
      const chunkSize = rawChunkSize - (rawChunkSize % 4);
      for (let i = 0; i < b64.length || i === 0; i += chunkSize) {
        const part = b64.slice(i, i + chunkSize);
        const op = i === 0 ? '>' : '>>';
        // The mkdir prefix only belongs on the first command.
        const prefix = i === 0 ? mkdir : '';
        const result = await this.nativeExecWithRecovery(`${prefix}echo '${part}' | base64 -d ${op} ${shellQuote(target)}`, '/workspace', SANDBOX_BUDGETS.fs);
        if (result.exitCode !== 0) throw new Error(result.output || `Failed to write ${path}`);
      }
      return;
    }
    await this.postJSON('/fs/write', { path, content }, SANDBOX_BUDGETS.fs);
  }

  async delete(path: string): Promise<void> {
    if (this.usingNativeFallback) {
      const result = await this.nativeExecWithRecovery(`rm -rf -- ${shellQuote(workspacePath(path))}`, '/workspace', SANDBOX_BUDGETS.fs);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to delete ${path}`);
      return;
    }
    await this.postJSON('/fs/delete', { path }, SANDBOX_BUDGETS.fs);
  }

  async list(path?: string): Promise<SandboxFileEntry[]> {
    if (this.usingNativeFallback) {
      const target = workspacePath(path);
      const quotedTarget = shellQuote(target);
      // Probe once whether this box's stat understands `-c %Y`; when it does,
      // emit a 4th mtime column (epoch seconds). busybox stat on some builds
      // lacks it, so fall back gracefully to the original 3-column output.
      let withMtime = false;
      try {
        const probe = await this.nativeExecWithRecovery(`stat -c %Y ${quotedTarget} >/dev/null 2>&1`, '/workspace', SANDBOX_BUDGETS.list);
        withMtime = probe.exitCode === 0;
      } catch {
        withMtime = false;
      }
      const mtimeExpr = withMtime ? 'mtime=$(stat -c %Y "$item" 2>/dev/null || echo 0); ' : '';
      const dirFormat = withMtime ? "printf 'd\\t0\\t%s\\t%s\\n' \"$name\" \"$mtime\"" : "printf 'd\\t0\\t%s\\n' \"$name\"";
      const fileFormat = withMtime
        ? "size=$(wc -c < \"$item\"); printf 'f\\t%s\\t%s\\t%s\\n' \"$size\" \"$name\" \"$mtime\""
        : "size=$(wc -c < \"$item\"); printf 'f\\t%s\\t%s\\n' \"$size\" \"$name\"";
      const command = `for item in ${quotedTarget}/* ${quotedTarget}/.[!.]* ${quotedTarget}/..?*; do [ -e "$item" ] || continue; name=$(basename "$item"); ${mtimeExpr}if [ -d "$item" ]; then ${dirFormat}; else ${fileFormat}; fi; done`;
      const result = await this.nativeExecWithRecovery(command, '/workspace', SANDBOX_BUDGETS.list);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to list ${target}`);
      return result.output.split('\n').filter(Boolean).map(line => {
        const fields = line.split('\t');
        const kind = fields[0] || '';
        const rawSize = fields[1] || '0';
        // 4-column probe output (kind, size, name…, mtime) vs 3-column
        // fallback (kind, size, name…) — names containing tabs are preserved
        // either way by joining the middle fields.
        if (fields.length >= 4) {
          const seconds = Number(fields[fields.length - 1]);
          return {
            name: fields.slice(2, -1).join('\t'),
            isDir: kind === 'd',
            size: Number(rawSize) || 0,
            mode: kind,
            ...(Number.isFinite(seconds) && seconds > 0 ? { mtimeMs: seconds * 1000 } : {}),
          };
        }
        const name = fields.slice(2).join('\t');
        return { name, isDir: kind === 'd', size: Number(rawSize) || 0, mode: kind };
      });
    }
    const p = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await this.request(`/fs/list${p}`, { method: 'GET' }, SANDBOX_BUDGETS.list);
    const data = await res.json() as { entries: SandboxFileEntry[] };
    return data.entries;
  }

  async restartContainer(): Promise<void> {
    if (this.usingNativeFallback) return;
    await this.postJSON('/container/restart', {}, SANDBOX_BUDGETS.exec);
    this._available = null;
  }

  /**
   * Returns null instead of a broken link when running on the native
   * fallback — there's no HTTP server to serve the file from, so a caller
   * needs to say so rather than show the person a dead download link.
   */
  downloadUrl(path: string): string | null {
    if (this.usingNativeFallback) return null;
    return `${this.baseUrl}/fs/download?path=${encodeURIComponent(path)}`;
  }
}

export default new SandboxService();
