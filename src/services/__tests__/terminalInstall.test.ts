import { describe, it, expect } from 'vitest';
import {
  parseInstalledPackageNames, toDistroPackage, tailOutput, runFullInstall,
  selectReachableMirror, verifyBinaries, runUpdatePackages, ALPINE_MIRRORS,
  confirmPackageInstalled, mentionsProotPermissionErrors,
  type ExecFn,
} from '../terminalInstall';

const noSleep = async () => {};
const noLog = () => {};

describe('parseInstalledPackageNames', () => {
  it('parses `apk list --installed` lines (name-version-release first token)', () => {
    const out = [
      'python3-3.12.11-r0 aarch64 {python3} (PSF-2.0) [installed]',
      'py3-pip-24.3.1-r0 noarch {py3-pip} (MIT) [installed]',
      'g++-14.2.0-r4 aarch64 {gcc} (GPL-3.0-or-later) [installed]',
      'php83-8.3.14-r0 aarch64 {php83} (PHP-3.01) [installed]',
      'libstdc++-14.2.0-r4 aarch64 {gcc} (GPL) [installed]',
    ].join('\n');
    const names = parseInstalledPackageNames(out);
    for (const n of ['python3', 'py3-pip', 'g++', 'php83', 'libstdc++']) expect(names.has(n)).toBe(true);
    expect(names.has('gcc')).toBe(false);
  });

  it('parses dpkg-query and bare `apk info` output', () => {
    const names = parseInstalledPackageNames('python3 install ok installed\ngit\n\n');
    expect(names.has('python3')).toBe(true);
    expect(names.has('git')).toBe(true);
  });
});

describe('toDistroPackage', () => {
  it('maps Alpine names to Ubuntu names only on Ubuntu', () => {
    expect(toDistroPackage('build-base', 'ubuntu')).toBe('build-essential');
    expect(toDistroPackage('sqlite', 'ubuntu')).toBe('sqlite3');
    expect(toDistroPackage('build-base', 'alpine')).toBe('build-base');
    expect(toDistroPackage('git', 'ubuntu')).toBe('git');
  });
});

describe('tailOutput', () => {
  it('keeps the last meaningful lines', () => {
    expect(tailOutput('a\n\nb\nc\n', 2)).toBe('b | c');
    expect(tailOutput(undefined)).toBe('');
  });
});

describe('selectReachableMirror', () => {
  it('uses the first mirror that answers the probe', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.includes('alpine-release')) return { output: 'v3.21', exitCode: 0 };
      if (cmd.includes(ALPINE_MIRRORS[0])) return { output: 'REACHABLE', exitCode: 0 };
      return { output: '', exitCode: 1 };
    };
    const r = await selectReachableMirror(exec, noLog);
    expect(r.mirror).toBe(ALPINE_MIRRORS[0]);
    expect(r.reachable).toBe(true);
  });

  it('falls through to the next mirror when the first does not respond', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.includes('alpine-release')) return { output: 'v3.21', exitCode: 0 };
      if (cmd.includes(ALPINE_MIRRORS[0])) return { output: '', exitCode: 1 };
      if (cmd.includes(ALPINE_MIRRORS[1])) return { output: 'REACHABLE', exitCode: 0 };
      return { output: '', exitCode: 1 };
    };
    const r = await selectReachableMirror(exec, noLog);
    expect(r.mirror).toBe(ALPINE_MIRRORS[1]);
    expect(r.reachable).toBe(true);
  });

  it('reports unreachable instead of throwing when nothing responds', async () => {
    const exec: ExecFn = async () => ({ output: '', exitCode: 1 });
    const r = await selectReachableMirror(exec, noLog);
    expect(r.reachable).toBe(false);
  });
});

describe('verifyBinaries', () => {
  it('confirms a package with no binary check (e.g. ca-certificates) without running anything', async () => {
    const exec: ExecFn = async () => { throw new Error('should not be called'); };
    const r = await verifyBinaries(exec, ['ca-certificates']);
    expect(r.confirmed).toEqual(['ca-certificates']);
    expect(r.broken).toEqual([]);
  });

  it('demotes a package the DB calls installed when its binary does not actually run', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.startsWith('gcc')) return { output: 'sh: gcc: not found', exitCode: 127 };
      if (cmd.startsWith('git')) return { output: 'git version 2.47.3', exitCode: 0 };
      return { output: '', exitCode: 0 };
    };
    const r = await verifyBinaries(exec, ['build-base', 'git']);
    expect(r.confirmed).toEqual(['git']);
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0].pkg).toBe('build-base');
    expect(r.broken[0].reason).toContain("doesn't run");
  });
});

describe('runUpdatePackages', () => {
  it('reports how many packages were upgraded', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.includes('alpine-release')) return { output: 'v3.21', exitCode: 0 };
      if (cmd.includes('APKINDEX')) return { output: 'REACHABLE', exitCode: 0 };
      if (cmd.startsWith('apk update')) return { output: 'v3.21 ok', exitCode: 0 };
      if (cmd.startsWith('apk upgrade')) {
        return { output: 'Upgrading git (2.47.2-r0 -> 2.47.3-r0)\nUpgrading jq (1.7-r0 -> 1.7.1-r0)\nOK: 2 packages upgraded', exitCode: 0 };
      }
      return { output: '', exitCode: 0 };
    };
    const r = await runUpdatePackages({ os: 'alpine', exec, sleep: noSleep });
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('2 package');
  });

  it('reports up to date when nothing changes', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.startsWith('apk upgrade')) return { output: 'OK: 0 packages upgraded', exitCode: 0 };
      return { output: 'ok', exitCode: 0 };
    };
    const r = await runUpdatePackages({ os: 'alpine', exec, sleep: noSleep });
    expect(r.ok).toBe(true);
    expect(r.summary).toBe('Already up to date');
  });

  it('surfaces the real error when the index cannot be reached', async () => {
    const exec: ExecFn = async (cmd) => {
      if (cmd.startsWith('apk update')) return { output: 'ERROR: network unreachable', exitCode: 1 };
      return { output: '', exitCode: 0 };
    };
    const r = await runUpdatePackages({ os: 'alpine', exec, sleep: noSleep });
    expect(r.ok).toBe(false);
    expect(r.summary).toContain('network unreachable');
  });
});

function fakeTerminal(opts: { failBatchTimes?: number; badPackages?: string[]; lieAboutExit?: string[]; brokenBinaries?: string[] } = {}) {
  const installed = new Set<string>();
  let batchCalls = 0;
  const calls: string[] = [];
  const bad = new Set(opts.badPackages ?? []);
  const brokenBinaries = new Set(opts.brokenBinaries ?? []);
  const binaryCheck: Record<string, string> = { nodejs: 'node', git: 'git', python3: 'python3', 'build-base': 'gcc', npm: 'npm' };
  const exec: ExecFn = async (cmd) => {
    calls.push(cmd);
    if (cmd.includes('alpine-release')) return { output: 'v3.21', exitCode: 0 };
    if (cmd.includes('APKINDEX')) return { output: 'REACHABLE', exitCode: 0 };
    if (cmd.startsWith('apk update')) return { output: 'v3.21 ok', exitCode: 0 };
    if (cmd.startsWith('apk add')) {
      const pkgs = cmd.replace(/^apk add --no-cache --no-progress /, '').replace(/ 2>&1$/, '').split(' ');
      if (pkgs.length > 1) {
        batchCalls++;
        if (batchCalls <= (opts.failBatchTimes ?? 0)) return { output: 'ERROR: temporary error (try again later)', exitCode: 99 };
        if (pkgs.some(p => bad.has(p))) {
          pkgs.filter(p => !bad.has(p)).forEach(p => installed.add(p));
          return { output: `ERROR: unable to select packages: ${[...bad].join(', ')}`, exitCode: 1 };
        }
      } else if (bad.has(pkgs[0])) {
        return { output: `ERROR: unable to select packages:\n  ${pkgs[0]} (no such package)`, exitCode: 1 };
      }
      pkgs.forEach(p => { if (!(opts.lieAboutExit ?? []).includes(p)) installed.add(p); });
      return { output: 'OK', exitCode: 0 };
    }
    if (cmd.startsWith('apk info -e')) {
      const pkgs = cmd.replace('apk info -e ', '').replace(' 2>/dev/null', '').split(' ');
      return { output: pkgs.filter(p => installed.has(p)).join('\n'), exitCode: 0 };
    }
    for (const [pkg, bin] of Object.entries(binaryCheck)) {
      if (cmd.startsWith(`${bin} --version`)) {
        if (brokenBinaries.has(pkg)) return { output: `sh: ${bin}: not found`, exitCode: 127 };
        return { output: `${bin} version 1.0.0`, exitCode: 0 };
      }
    }
    return { output: '', exitCode: 0 };
  };
  return { exec, calls, installed, get batchCalls() { return batchCalls; } };
}

describe('runFullInstall', () => {
  it('installs everything in ONE batch (single index fetch) on the happy path', async () => {
    const t = fakeTerminal();
    const r = await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git', 'jq', 'tree'] });
    expect(r.failed).toEqual([]);
    expect(r.installed.sort()).toEqual(['git', 'jq', 'tree']);
    expect(t.calls.filter(c => c.startsWith('apk add'))).toHaveLength(1);
  });

  it('tests mirrors before touching the package index', async () => {
    const t = fakeTerminal();
    await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git'] });
    const mirrorIdx = t.calls.findIndex(c => c.includes('APKINDEX'));
    const updateIdx = t.calls.findIndex(c => c.startsWith('apk update'));
    expect(mirrorIdx).toBeGreaterThanOrEqual(0);
    expect(mirrorIdx).toBeLessThan(updateIdx);
  });

  it('clears a stale apk lock (left by a timed-out install) before installing', async () => {
    const t = fakeTerminal();
    await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git'] });
    const lockIdx = t.calls.findIndex(c => c.includes('/lib/apk/db/lock'));
    const firstApk = t.calls.findIndex(c => c.startsWith('apk '));
    expect(lockIdx).toBeGreaterThanOrEqual(0);
    expect(lockIdx).toBeLessThan(firstApk);
  });

  it('retries a failed batch once before giving up', async () => {
    const t = fakeTerminal({ failBatchTimes: 1 });
    const r = await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git', 'jq'] });
    expect(r.failed).toEqual([]);
    expect(t.batchCalls).toBe(2);
  });

  it('isolates a single bad package and reports the real reason', async () => {
    const t = fakeTerminal({ badPackages: ['jq'] });
    const r = await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git', 'jq', 'tree'] });
    expect(r.installed.sort()).toEqual(['git', 'tree']);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].pkg).toBe('jq');
    expect(r.failed[0].reason).toContain('no such package');
  });

  it('does not trust a zero exit code when the package is not actually present', async () => {
    const t = fakeTerminal({ lieAboutExit: ['tree'] });
    const r = await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git', 'tree'] });
    expect(r.failed.map(f => f.pkg)).toEqual(['tree']);
  });

  it('demotes a package apk calls installed but whose binary does not run (the Full Install vs Mical gap)', async () => {
    const t = fakeTerminal({ brokenBinaries: ['build-base'] });
    const r = await runFullInstall({ os: 'alpine', exec: t.exec, sleep: noSleep, packages: ['git', 'build-base'] });
    expect(r.installed).toEqual(['git']);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].pkg).toBe('build-base');
    expect(r.failed[0].reason).toContain("doesn't run");
  });

  it('reports a dead terminal instead of hanging or throwing', async () => {
    const exec: ExecFn = async () => null;
    const r = await runFullInstall({ os: 'alpine', exec, sleep: noSleep, packages: ['git'] });
    expect(r.failed).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('no response from terminal');
  });
});


describe('proot permission errors are not install failures', () => {
  const PERM = 'ERROR: 2 errors updating directory permissions\nExecuting busybox-1.37.0-r14.trigger\n5 errors; 406 MiB in 99 packages';

  it('detects the apk directory-permission error', () => {
    expect(mentionsProotPermissionErrors(PERM)).toBe(true);
    expect(mentionsProotPermissionErrors('ERROR: unable to select packages')).toBe(false);
    expect(mentionsProotPermissionErrors(undefined)).toBe(false);
  });

  it('confirmPackageInstalled trusts the package database, not the exit code', async () => {
    const present: ExecFn = async cmd => (cmd.startsWith('apk info -e') ? { output: 'nano\n', exitCode: 0 } : { output: '', exitCode: 0 });
    const absent: ExecFn = async () => ({ output: '', exitCode: 1 });
    expect(await confirmPackageInstalled(present, 'alpine', 'nano')).toBe(true);
    expect(await confirmPackageInstalled(absent, 'alpine', 'nano')).toBe(false);
  });

  it('update with permission errors succeeds when nothing is left to upgrade', async () => {
    const exec: ExecFn = async cmd => {
      if (cmd.startsWith('apk upgrade')) return { output: PERM, exitCode: 1 };
      if (cmd.startsWith("apk version")) return { output: '', exitCode: 0 };
      return { output: 'ok', exitCode: 0 };
    };
    const r = await runUpdatePackages({ os: 'alpine', exec, sleep: noSleep, onLog: noLog });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/directory permissions/);
  });

  it('update still fails when packages remain out of date', async () => {
    const exec: ExecFn = async cmd => {
      if (cmd.startsWith('apk upgrade')) return { output: PERM, exitCode: 1 };
      if (cmd.startsWith("apk version")) return { output: 'busybox-1.37.0-r8 < 1.37.0-r14', exitCode: 0 };
      return { output: 'ok', exitCode: 0 };
    };
    const r = await runUpdatePackages({ os: 'alpine', exec, sleep: noSleep, onLog: noLog });
    expect(r.ok).toBe(false);
  });
});
