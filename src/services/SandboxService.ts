import { useGiaStore } from '../../store/useGiaStore';

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

const DEFAULT_SANDBOX_URL = 'http://localhost:3081';

class SandboxService {
  private baseUrl: string = DEFAULT_SANDBOX_URL;
  private _available: boolean | null = null;
  private healthCheckPromise: Promise<boolean> | null = null;

  setBaseUrl(url: string) { this.baseUrl = url.replace(/\/+$/, ''); }
  getBaseUrl() { return this.baseUrl; }

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
    return this.healthCheckPromise;
  }

  get available(): boolean | null { return this._available; }

  async exec(command: string, options?: { timeout?: number; workdir?: string }): Promise<SandboxResult> {
    const data = await this.postJSON('/exec', { command, timeout: options?.timeout, workdir: options?.workdir }) as SandboxResult;
    return data;
  }

  async install(packages: string | string[]): Promise<SandboxResult> {
    const pkgList = Array.isArray(packages) ? packages : [packages];
    const data = await this.postJSON('/install', { packages: pkgList }) as SandboxResult;
    return data;
  }

  async clone(repo: string, dest?: string): Promise<SandboxResult> {
    const data = await this.postJSON('/clone', { repo, dest }) as SandboxResult;
    return data;
  }

  async readFile(path: string): Promise<string> {
    const res = await this.request(`/fs/read?path=${encodeURIComponent(path)}`);
    const data = await res.json() as { content: string };
    return data.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.postJSON('/fs/write', { path, content });
  }

  async delete(path: string): Promise<void> {
    await this.postJSON('/fs/delete', { path });
  }

  async list(path?: string): Promise<SandboxFileEntry[]> {
    const p = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await this.request(`/fs/list${p}`);
    const data = await res.json() as { entries: SandboxFileEntry[] };
    return data.entries;
  }

  async restartContainer(): Promise<void> {
    await this.postJSON('/container/restart', {});
    this._available = null;
  }

  downloadUrl(path: string): string {
    return `${this.baseUrl}/fs/download?path=${encodeURIComponent(path)}`;
  }
}

export default new SandboxService();
