

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

  async exec(command: string, options?: { timeout?: number; workdir?: string }): Promise<SandboxResult> {
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(command, options?.workdir, undefined, options?.timeout);
      return { stdout: result.output, stderr: '', exitCode: result.exitCode };
    }
    const data = await this.postJSON('/exec', { command, timeout: options?.timeout, workdir: options?.workdir }) as SandboxResult;
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

  async clone(repo: string, dest?: string): Promise<SandboxResult> {
    if (this.usingNativeFallback) {
      return this.exec(`git clone ${repo}${dest ? ` ${dest}` : ''}`);
    }
    const data = await this.postJSON('/clone', { repo, dest }) as SandboxResult;
    return data;
  }

  async readFile(path: string): Promise<string> {
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(`cat -- "${path.replace(/"/g, '\\"')}"`);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to read ${path}`);
      return result.output;
    }
    const res = await this.request(`/fs/read?path=${encodeURIComponent(path)}`);
    const data = await res.json() as { content: string };
    return data.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.usingNativeFallback) {
      // Base64 round-trip avoids any quoting/escaping issues with the shell heredoc.
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const result = await terminalService.exec(`echo '${b64}' | base64 -d > "${path.replace(/"/g, '\\"')}"`);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to write ${path}`);
      return;
    }
    await this.postJSON('/fs/write', { path, content });
  }

  async delete(path: string): Promise<void> {
    if (this.usingNativeFallback) {
      const result = await terminalService.exec(`rm -rf -- "${path.replace(/"/g, '\\"')}"`);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to delete ${path}`);
      return;
    }
    await this.postJSON('/fs/delete', { path });
  }

  async list(path?: string): Promise<SandboxFileEntry[]> {
    if (this.usingNativeFallback) {
      const target = path || '.';
      const result = await terminalService.exec(`ls -lA --time-style=+ -- "${target.replace(/"/g, '\\"')}"`);
      if (result.exitCode !== 0) throw new Error(result.output || `Failed to list ${target}`);
      return result.output.split('\n').slice(1).filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/);
        const mode = parts[0] || '';
        const size = Number(parts[4]) || 0;
        const name = parts.slice(5).join(' ');
        return { name, isDir: mode.startsWith('d'), size, mode };
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
