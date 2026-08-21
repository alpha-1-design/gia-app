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

// proot spews these to stderr when the on-device rootfs/binary is broken --
// they must never be mistaken for a real package version.
const PROOT_FAILURE = /fatal error|libproot|proot (error|warning)|No such file or directory|can't chdir|\/usr\/bin\/env'? ?not found/i;

function isProotFailure(output: string): boolean {
  return PROOT_FAILURE.test(output || '');
}

function parseVersion(output: string): string | null {
  const line = (output || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop()
    ?.trim();
  if (!line || /not found|command not found|sh: .*: not found/i.test(line)) return null;
  if (isProotFailure(line)) return null;
  return line;
}

/**
 * Manages the on-device proot+Alpine build environment (native terminal).
 * This is what makes Build Mode serve apps *in the app* -- packages persist
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
      if (r.exitCode === -1 && r.sessionId === 'mock') return false;
      return !isProotFailure(r.output || '');
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
      if ((r.exitCode === -1 && r.sessionId === 'mock') || isProotFailure(r.output || '')) {
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
          if (isProotFailure(r.output || '')) {
            return { key: p.key, label: p.label, version: null, ok: false };
          }
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

  /**
   * Full install: reinstall rootfs from assets, then provision packages.
   * This is the main "Set Up Environment" entry point. It breaks the
   * chicken-and-egg by reinstalling the rootfs BEFORE trying to run
   * commands inside proot. Kai-style: per-package progress with live logs.
   */
  async installEnvironment(
    onProgress?: (msg: string, stepIndex?: number, totalSteps?: number) => void,
  ): Promise<{ success: boolean; output: string }> {
    const logs: string[] = [];
    const totalSteps = 10; // rootfs + 9 package steps

    try {
      // Step 1: Reinstall rootfs from APK assets
      onProgress?.('[1/10] Reinstalling root filesystem...', 1, totalSteps);
      logs.push('Step 1/10: Reinstalling root filesystem from assets...');

      try {
        const reinstallResult = await terminalService.reinstallRootfs();
        logs.push(`Rootfs: ${reinstallResult.message}`);
      } catch (e) {
        logs.push(`Rootfs reinstall failed: ${e instanceof Error ? e.message : String(e)}`);
        logs.push('Attempting to continue with existing rootfs...');
      }

      // Brief pause to let the native extraction latch release
      await new Promise(r => setTimeout(r, 1500));

      // Now check if we can actually execute
      if (!(await this.isExecutable())) {
        return {
          success: false,
          output: logs.join('\n') + '\n\nRoot filesystem could not be made functional.\nYour device may block binary execution from app data.\n\nTry: Settings > Developer > Toggle sandbox permissions.',
        };
      }

      logs.push('Root filesystem is functional');
      logs.push('');

      // Steps 2-10: Per-package provisioning
      const STEPS: [string, string, string][] = [
        ['DNS resolution', 'resolvconf', 'test -f /etc/resolv.conf'],
        ['Package index', '', ''],
        ['Node.js runtime', 'nodejs', 'node --version'],
        ['npm package manager', 'npm', 'npm --version'],
        ['Git version control', 'git', 'git --version'],
        ['Python 3 runtime', 'python3', 'python3 --version'],
        ['Python pip', 'py3-pip', 'pip3 --version'],
        ['C/C++ toolchain', 'build-base gcc g++ make', 'gcc --version'],
        ['Utilities (curl, wget, bash)', 'curl wget bash', 'curl --version'],
      ];

      for (let i = 0; i < STEPS.length; i++) {
        const [label, pkgs, checkCmd] = STEPS[i];
        const stepNum = i + 2; // steps 2-10 (step 1 was rootfs)
        onProgress?.(`[${stepNum}/${totalSteps}] ${label}`, stepNum, totalSteps);

        if (i === 0) {
          await run(
            "test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 > /etc/resolv.conf && echo nameserver 1.1.1.1 >> /etc/resolv.conf)",
            15000,
          );
          logs.push('Step ' + stepNum + '/10: DNS configured');
          continue;
        }

        if (i === 1) {
          const upd = await run('apk update', 120000);
          logs.push('Step ' + stepNum + '/10: Package index updated');
          if (upd.output) logs.push(`  ${upd.output.split('\n').slice(-2).join('\n  ')}`);
          continue;
        }

        // Check if already installed
        if (checkCmd) {
          const check = await run(checkCmd, 10000);
          if (check.exitCode === 0 && check.output && !isProotFailure(check.output)) {
            logs.push(`Step ${stepNum}/10: ${label} -- already installed`);
            continue;
          }
        }

        onProgress?.(`[${stepNum}/${totalSteps}] Installing ${label}...`, stepNum, totalSteps);
        const inst = await run(`apk add ${pkgs}`, 180000);
        if (inst.exitCode === 0) {
          logs.push(`Step ${stepNum}/10: ${label} installed`);
        } else {
          logs.push(`Step ${stepNum}/10: ${label} -- installed with warnings`);
          if (inst.output) logs.push(`  ${inst.output.split('\n').slice(-2).join('\n  ')}`);
        }
      }

      onProgress?.('Verifying environment...', totalSteps, totalSteps);
      logs.push('');
      logs.push('Verifying environment...');
      const s = await this.status();
      if (s.ready) {
        logs.push('All packages verified. Environment is ready.');
      } else {
        logs.push('Some packages may not have installed correctly. Check the Pre-installed Packages tab.');
      }
      return { success: s.ready, output: logs.join('\n') };
    } catch (e) {
      return { success: false, output: logs.join('\n') + '\n' + (e instanceof Error ? e.message : String(e)) };
    }
  },

  /**
   * Per-package provisioning with live progress.
   * Installs each package group individually so the UI can show a real
   * progress bar and per-step log.
   */
  async provision(
    onProgress?: (msg: string, stepIndex?: number, totalSteps?: number) => void,
  ): Promise<{ success: boolean; output: string }> {
    if (!(await this.isExecutable())) {
      return { success: false, output: 'On-device sandbox terminal is not available on this device. Try "Set Up Environment" first to install the root filesystem.' };
    }

    // Each step: [label, apk-packages, check-command]
    const STEPS: [string, string, string][] = [
      ['DNS resolution', 'resolvconf', 'test -f /etc/resolv.conf'],
      ['Package index', '', ''],
      ['Node.js runtime', 'nodejs', 'node --version'],
      ['npm package manager', 'npm', 'npm --version'],
      ['Git version control', 'git', 'git --version'],
      ['Python 3 runtime', 'python3', 'python3 --version'],
      ['Python pip', 'py3-pip', 'pip3 --version'],
      ['C/C++ toolchain (gcc, g++, make)', 'build-base gcc g++ make', 'gcc --version'],
      ['Utilities (curl, wget, bash)', 'curl wget bash', 'curl --version'],
    ];

    const totalSteps = STEPS.length;
    const logs: string[] = [];

    try {
      for (let i = 0; i < STEPS.length; i++) {
        const [label, pkgs, checkCmd] = STEPS[i];
        onProgress?.(`[${i + 1}/${totalSteps}] ${label}`, i + 1, totalSteps);

        // Step 0: DNS
        if (i === 0) {
          await run(
            "test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 > /etc/resolv.conf && echo nameserver 1.1.1.1 >> /etc/resolv.conf)",
            15000,
          );
          logs.push('DNS configured');
          continue;
        }

        // Step 1: Package index
        if (i === 1) {
          const upd = await run('apk update', 120000);
          logs.push('Package index updated');
          if (upd.output) logs.push(`  ${upd.output.split('\n').slice(-2).join('\n  ')}`);
          continue;
        }

        // Check if already installed
        if (checkCmd) {
          const check = await run(checkCmd, 10000);
          if (check.exitCode === 0 && check.output && !isProotFailure(check.output)) {
            logs.push(`${label} -- already installed`);
            continue;
          }
        }

        // Install
        onProgress?.(`[${i + 1}/${totalSteps}] Installing ${label}...`, i + 1, totalSteps);
        const inst = await run(`apk add ${pkgs}`, 180000);
        if (inst.exitCode === 0) {
          logs.push(`${label} installed`);
        } else {
          logs.push(`${label} -- installed with warnings`);
          if (inst.output) logs.push(`  ${inst.output.split('\n').slice(-2).join('\n  ')}`);
        }
      }

      onProgress?.('Verifying environment...', totalSteps, totalSteps);
      const s = await this.status();
      return { success: s.ready, output: logs.join('\n') };
    } catch (e) {
      return { success: false, output: logs.join('\n') + '\n' + (e instanceof Error ? e.message : String(e)) };
    }
  },

  async repair(onProgress?: (msg: string) => void): Promise<{ success: boolean; output: string }> {
    if (!(await this.isExecutable())) {
      return { success: false, output: 'On-device sandbox terminal is not available on this device.' };
    }
    try {
      onProgress?.('Fixing packages (apk fix)...');
      await run('apk update', 120000);
      await run('apk upgrade', 180000);
      await run('apk fix', 120000);
      onProgress?.('Re-installing build environment...');
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
      onProgress?.('Removing installed packages...');
      await run(`apk del -r ${BUILD_PACKAGES} || true`, 120000);
      await this.status();
      return {
        success: true,
        output: 'Environment reset. Installed packages removed -- re-run Set up to reinstall.',
      };
    } catch (e) {
      return { success: false, output: e instanceof Error ? e.message : String(e) };
    }
  },
};

export default SandboxEnvService;
