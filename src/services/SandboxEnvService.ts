import terminalService from './TerminalService';
import { useGiaStore } from '../store/useGiaStore';

export interface PkgStatus {
  key: string;
  label: string;
  version: string | null;
  ok: boolean;
}

export interface SandboxStatus {
  available: boolean;
  resolv: boolean;
  packages: PkgStatus[];
  ready: boolean;
}

/** Packages installed by "Set up build environment". */
export const BUILD_PACKAGES = 'nodejs npm git bash curl wget build-base gcc g++ make python3 py3-pip';

const PKG_DEFS: { key: string; label: string; cmd: string }[] = [
  { key: 'node', label: 'Node.js', cmd: 'node --version' },
  { key: 'npm', label: 'npm', cmd: 'npm --version' },
  { key: 'git', label: 'Git', cmd: 'git --version' },
  { key: 'python3', label: 'Python 3', cmd: 'python3 --version' },
  { key: 'gcc', label: 'build-base (gcc)', cmd: 'gcc --version' },
];

let cached: SandboxStatus | null = null;

const run = (command: string, timeout = 60000) =>
  terminalService.exec(command, undefined, undefined, timeout);

function parseVersion(output: string): string | null {
  const line = (output || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop()
    ?.trim();
  if (!line || /not found|command not found|sh: .*: not found/i.test(line)) return null;
  return line;
}

/**
 * Manages the on-device proot+Alpine build environment (native terminal).
 * This is what makes Build Mode serve apps *in the app* — packages persist
 * in the Alpine rootfs on disk, so setup is a one-time cost.
 */
export const SandboxEnvService = {
  isAvailable(): boolean {
    return terminalService.isAvailable();
  },

  /** True only if the plugin is registered AND proot can actually execute. */
  async isExecutable(): Promise<boolean> {
    if (!terminalService.isAvailable()) return false;
    try {
      const r = await run('echo ok', 15000);
      return !(r.exitCode === -1 && r.sessionId === 'mock');
    } catch {
      return false;
    }
  },

  getCached(): SandboxStatus | null {
    return cached;
  },

  async status(): Promise<SandboxStatus> {
    if (!terminalService.isAvailable()) {
      cached = { available: false, resolv: false, packages: [], ready: false };
      useGiaStore.getState().setSandboxEnvReady(false);
      return cached;
    }

    // Probe proot for real: the plugin may be registered yet proot still fails
    // to execute (libproot.so failed to load, or Android W^X blocks the
    // extracted binary). In that case report unavailable rather than "missing".
    let resolv = false;
    try {
      const r = await run('test -f /etc/resolv.conf && echo YES || echo NO', 15000);
      if (r.exitCode === -1 && r.sessionId === 'mock') {
        cached = { available: false, resolv: false, packages: [], ready: false };
        useGiaStore.getState().setSandboxEnvReady(false);
        return cached;
      }
      resolv = /YES/.test(r.output || '');
    } catch {
      cached = { available: false, resolv: false, packages: [], ready: false };
      useGiaStore.getState().setSandboxEnvReady(false);
      return cached;
    }

    const packages = await Promise.all(
      PKG_DEFS.map(async (p) => {
        try {
          const r = await run(`${p.cmd} 2>/dev/null || true`, 20000);
          const version = parseVersion(r.output || '');
          return { key: p.key, label: p.label, version, ok: !!version };
        } catch {
          return { key: p.key, label: p.label, version: null, ok: false };
        }
      }),
    );

    const nodeOk = packages.find((p) => p.key === 'node')?.ok;
    const npmOk = packages.find((p) => p.key === 'npm')?.ok;
    cached = { available: true, resolv, packages, ready: !!nodeOk && !!npmOk };
    useGiaStore.getState().setSandboxEnvReady(cached.ready);
    return cached;
  },

  async provision(onProgress?: (msg: string) => void): Promise<{ success: boolean; output: string }> {
    if (!(await this.isExecutable())) {
      return { success: false, output: 'On-device sandbox terminal is not available on this device.' };
    }
    try {
      onProgress?.('Ensuring DNS (resolv.conf)…');
      await run(
        "test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 > /etc/resolv.conf && echo nameserver 1.1.1.1 >> /etc/resolv.conf)",
        20000,
      );
      onProgress?.('Updating package index (apk update)…');
      const upd = await run('apk update', 120000);
      onProgress?.('Installing Node.js, npm, git, build tools…');
      const inst = await run(`apk add ${BUILD_PACKAGES}`, 300000);
      const s = await this.status();
      return { success: s.ready, output: `${upd.output}\n${inst.output}` };
    } catch (e) {
      return { success: false, output: e instanceof Error ? e.message : String(e) };
    }
  },

  async repair(onProgress?: (msg: string) => void): Promise<{ success: boolean; output: string }> {
    if (!(await this.isExecutable())) {
      return { success: false, output: 'On-device sandbox terminal is not available on this device.' };
    }
    try {
      onProgress?.('Fixing packages (apk fix)…');
      await run('apk update', 120000);
      await run('apk upgrade', 180000);
      await run('apk fix', 120000);
      onProgress?.('Re-installing build environment…');
      const inst = await run(`apk add ${BUILD_PACKAGES}`, 300000);
      const s = await this.status();
      return { success: s.ready, output: inst.output };
    } catch (e) {
      return { success: false, output: e instanceof Error ? e.message : String(e) };
    }
  },

  async reset(onProgress?: (msg: string) => void): Promise<{ success: boolean; output: string }> {
    if (!(await this.isExecutable())) {
      return { success: false, output: 'On-device sandbox terminal is not available on this device.' };
    }
    try {
      onProgress?.('Removing installed packages…');
      await run(`apk del -r ${BUILD_PACKAGES} || true`, 120000);
      await this.status();
      return {
        success: true,
        output: 'Environment reset. Installed packages removed — re-run Set up to reinstall.',
      };
    } catch (e) {
      return { success: false, output: e instanceof Error ? e.message : String(e) };
    }
  },
};

export default SandboxEnvService;
