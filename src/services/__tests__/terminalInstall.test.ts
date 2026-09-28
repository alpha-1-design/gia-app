import { describe, it, expect } from 'vitest';
import {
  parseInstalledPackageNames, toDistroPackage, tailOutput, runFullInstall,
  type ExecFn,
} from '../terminalInstall';

const noSleep = async () => {};

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
    expect(names.has('gcc')).toBe(false); // origin field must not be mistaken for a package
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

/** Fake terminal: tracks which packages are "installed" and can be told to fail. */
function fakeTerminal(opts: { failBatchTimes?: number; badPackages?: string[]; lieAboutExit?: string[] } = {}) {
  const installed = new Set<string>();
  let batchCalls = 0;
  const calls: string[] = [];
  const bad = new Set(opts.badPackages ?? []);
  const exec: ExecFn = async (cmd) => {
    calls.push(cmd);
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
    return { output: '', exitCode: 0 }; // dns, mkdir
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

  it('reports a dead terminal instead of hanging or throwing', async () => {
    const exec: ExecFn = async () => null;
    const r = await runFullInstall({ os: 'alpine', exec, sleep: noSleep, packages: ['git'] });
    expect(r.failed).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('no response from terminal');
  });
});
