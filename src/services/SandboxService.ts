

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
}

const DEFAULT_SANDBOX_URL = typeof window !== 'undefined' && window.location?.origin
  ? '/api/sandbox'
  : 'http://localhost:3081';

export const PROJECTS_DIRECTORY = '/workspace/projects';

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

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
      signal: AbortSignal.timeout(options.method === 'GET' ? 10000 : 120000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Sandbox error ${res.status}: ${body || res.statusText}`);
    }
    return res;
  }

  private async postJSON(path: string, body: unknown): Promise<unknown> {
    const res = await this.request(path, { method: 'POST', body: JSON.stringify(body) });
    return res.json();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await this.request('/health', { method: 'GET' });
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

  async exec(command: string, options?: { timeout?: number; workdir?: string; env?: Record<string, string> }): Promise<SandboxResult> {
    if (!this.usingNativeFallback) {
      const available = await this.ensureAvailable();
      if (!available) {
        throw new Error('Sandbox is unavailable: start the desktop sandbox server or set up the native terminal.');
      }
    }
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(command, workspacePath(options?.workdir), options?.env, options?.timeout);
      return { stdout: result.output, stderr: '', exitCode: result.exitCode };
    }
    const data = await this.postJSON('/exec', { command, timeout: options?.timeout, workdir: workspacePath(options?.workdir) }) as SandboxResult;
    return data;
  }

  async install(packages: string | string[]): Promise<SandboxResult> {
    const pkgList = Array.isArray(packages) ? packages : [packages];
    if (this.usingNativeFallback) {
      return this.exec(`apk add --no-cache ${pkgList.join(' ')}`);
    }
    const data = await this.postJSON('/install', { packages: pkgList }) as SandboxResult;
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
      return this.exec(`mkdir -p ${shellQuote(PROJECTS_DIRECTORY)} && GIT_ASKPASS= GIT_TERMINAL_PROMPT=0 git clone --depth 1 ${shellQuote(cloneUrl)} ${shellQuote(`${PROJECTS_DIRECTORY}/${projectName}`)}`, { workdir: '/workspace', env: gitEnv });
    }
    const data = await this.postJSON('/clone', { repo: cloneUrl, dest: projectName, token: gitEnv ? token : undefined }) as SandboxResult;
    return data;
  }

  async readFile(path: string): Promise<string> {
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(`cat -- ${shellQuote(workspacePath(path))}`, '/workspace');
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to read ${path}`);
      return result.output;
    }
    const res = await this.request(`/fs/read?path=${encodeURIComponent(path)}`);
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
      // Base64 round-trip avoids any quoting/escaping issues with the shell heredoc.
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const result = await terminalService.exec(`${mkdir}echo '${b64}' | base64 -d > ${shellQuote(target)}`, '/workspace');
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to write ${path}`);
      return;
    }
    await this.postJSON('/fs/write', { path, content });
  }

  async delete(path: string): Promise<void> {
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(`rm -rf -- ${shellQuote(workspacePath(path))}`, '/workspace');
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to delete ${path}`);
      return;
    }
    await this.postJSON('/fs/delete', { path });
  }

  async list(path?: string): Promise<SandboxFileEntry[]> {
    if (this.usingNativeFallback) {
      const target = workspacePath(path);
      const quotedTarget = shellQuote(target);
      const command = `for item in ${quotedTarget}/* ${quotedTarget}/.[!.]* ${quotedTarget}/..?*; do [ -e "$item" ] || continue; name=$(basename "$item"); if [ -d "$item" ]; then printf 'd\\t0\\t%s\\n' "$name"; else size=$(wc -c < "$item"); printf 'f\\t%s\\t%s\\n' "$size" "$name"; fi; done`;
      const result = await terminalService.exec(command, '/workspace');
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to list ${target}`);
      return result.output.split('\n').filter(Boolean).map(line => {
        const [kind, rawSize, ...nameParts] = line.split('\t');
        const name = nameParts.join('\t');
        return { name, isDir: kind === 'd', size: Number(rawSize) || 0, mode: kind || '' };
      });
    }
    const p = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await this.request(`/fs/list${p}`);
    const data = await res.json() as { entries: SandboxFileEntry[] };
    return data.entries;
  }

  async restartContainer(): Promise<void> {
    if (this.usingNativeFallback) return;
    await this.postJSON('/container/restart', {});
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
