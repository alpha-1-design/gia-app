/**
 * terminalInstall — reliable package installation for the on-device Linux
 * terminal (Alpine via apk, Ubuntu via apt).
 *
 * Why this exists: "Full Install" used to run one `apk add --no-cache <pkg>`
 * per package. `--no-cache` re-downloads the package index on every call, so a
 * 21-package install made 21 index fetches over a mobile connection; when the
 * connection blipped, every remaining package failed and the user only saw a
 * bare list of names — no reason. Exit codes were also trusted blindly.
 *
 * This module installs everything in a single transaction, retries on
 * failure, verifies against the package database (the source of truth),
 * isolates individual failures, and reports the actual error text.
 */

export type DistroOs = 'alpine' | 'ubuntu';

export interface ExecResult {
  output: string;
  exitCode: number;
}

export type ExecFn = (command: string, timeoutMs?: number) => Promise<ExecResult | null>;

export const FULL_INSTALL_PACKAGES = [
  'python3', 'py3-pip', 'nodejs', 'npm', 'git', 'bash',
  'curl', 'wget', 'openssh', 'build-base', 'gcc', 'g++', 'make',
  'vim', 'jq', 'ripgrep', 'tree', 'zip', 'unzip',
  'sqlite', 'ca-certificates',
];

/** Alpine package names that differ on Debian/Ubuntu. */
const UBUNTU_NAMES: Record<string, string> = {
  'py3-pip': 'python3-pip',
  'build-base': 'build-essential',
  openssh: 'openssh-client',
  sqlite: 'sqlite3',
};

export function toDistroPackage(pkg: string, os: DistroOs): string {
  return os === 'ubuntu' ? (UBUNTU_NAMES[pkg] ?? pkg) : pkg;
}

/**
 * Extract package names from the output of `apk list --installed`,
 * `apk info`, `apk info -e`, or `dpkg-query -W`.
 *
 * `apk list --installed` lines look like
 *   python3-3.12.11-r0 aarch64 {python3} (PSF-2.0) [installed]
 * i.e. the first token is name-version-release, NOT the bare name. The old
 * matcher compared `startsWith('python3 ')`, which never matched on Alpine,
 * so the Packages tab always showed 0 installed.
 */
export function parseInstalledPackageNames(output: string): Set<string> {
  const names = new Set<string>();
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+)-(\d[^-\s]*)-r\d+(?=\s|$)/);
    if (m) {
      names.add(m[1]);
      continue;
    }
    names.add(line.split(/\s+/)[0]);
  }
  return names;
}

function addCommand(os: DistroOs, pkgs: string[]): string {
  const list = pkgs.join(' ');
  if (os === 'ubuntu') {
    return `DEBIAN_FRONTEND=noninteractive apt-get -o APT::Sandbox::User=root install -y ${list} 2>&1`;
  }
  return `apk add --no-cache --no-progress ${list} 2>&1`;
}

function updateCommand(os: DistroOs): string {
  return os === 'ubuntu'
    ? 'DEBIAN_FRONTEND=noninteractive apt-get -o APT::Sandbox::User=root update 2>&1'
    : 'apk update 2>&1';
}

function checkCommand(os: DistroOs, pkgs: string[]): string {
  const list = pkgs.join(' ');
  return os === 'ubuntu'
    ? `dpkg-query -W -f='\${Package} \${Status}\\n' ${list} 2>/dev/null | grep 'install ok installed'`
    : `apk info -e ${list} 2>/dev/null`;
}

/** Last few meaningful lines of command output, trimmed for display. */
export function tailOutput(output: string | undefined, lines = 2, maxLen = 220): string {
  if (!output) return '';
  const parts = output.split('\n').map(l => l.trim()).filter(Boolean);
  return parts.slice(-lines).join(' | ').slice(-maxLen);
}

export interface FullInstallDeps {
  os: DistroOs;
  exec: ExecFn;
  /** Short status line for the progress card. */
  onProgress?: (message: string) => void;
  /** Lines appended to the Live Output panel. */
  onLog?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  packages?: string[];
}

export interface FullInstallResult {
  installed: string[];
  failed: { pkg: string; reason: string }[];
  warnings: string[];
}

const realSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function runFullInstall(deps: FullInstallDeps): Promise<FullInstallResult> {
  const { os, exec } = deps;
  const progress = deps.onProgress ?? (() => {});
  const log = deps.onLog ?? (() => {});
  const sleep = deps.sleep ?? realSleep;
  const warnings: string[] = [];

  const safeExec = (cmd: string, timeout: number) => exec(cmd, timeout).catch(() => null);
  const logTail = (out: string | undefined, n = 4) => {
    (out ?? '').split('\n').map(l => l.trim()).filter(Boolean).slice(-n).forEach(l => log(`[packages] ${l}`));
  };

  // 1. DNS — the package manager must be able to resolve its mirrors.
  progress('Configuring DNS...');
  log('[packages] Configuring DNS...');
  const dns = await safeExec(
    'test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 > /etc/resolv.conf && echo nameserver 1.1.1.1 >> /etc/resolv.conf)',
    15000,
  );
  if (!dns || dns.exitCode !== 0) {
    warnings.push(`DNS setup: ${tailOutput(dns?.output) || 'no response from terminal'}`);
  }

  // A previous install that timed out is killed mid-transaction and leaves
  // apk's database lock behind, after which EVERY later `apk add` fails.
  // Nothing else is running the package manager during Full Install, so a
  // leftover lock is always stale.
  if (os === 'alpine') {
    await safeExec('rm -f /lib/apk/db/lock', 10000);
  } else {
    await safeExec('rm -f /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock; dpkg --configure -a 2>&1 | tail -2', 60000);
  }

  // 2. Package index, with retries.
  progress('Updating package index...');
  log('[packages] Updating package index...');
  let indexOk = false;
  let indexOut = '';
  for (let attempt = 1; attempt <= 3 && !indexOk; attempt++) {
    const r = await safeExec(updateCommand(os), 120000);
    indexOut = r?.output ?? '';
    indexOk = !!r && r.exitCode === 0;
    if (!indexOk && attempt < 3) {
      log(`[packages] Index update failed (attempt ${attempt}/3), retrying...`);
      await sleep(2000 * attempt);
    }
  }
  if (!indexOk) warnings.push(`package index update: ${tailOutput(indexOut) || 'no response from terminal'}`);
  else log('[packages] Package index updated');

  // 3. One transaction for everything (a single index fetch, a single lock).
  const wanted = Array.from(new Set((deps.packages ?? FULL_INSTALL_PACKAGES).map(p => toDistroPackage(p, os))));
  progress(`Installing ${wanted.length} packages (this can take several minutes)...`);
  log(`[packages] Installing ${wanted.length} packages in one batch...`);
  let batchOk = false;
  let batchOut = '';
  for (let attempt = 1; attempt <= 2 && !batchOk; attempt++) {
    const r = await safeExec(addCommand(os, wanted), 20 * 60 * 1000);
    batchOut = r?.output ?? '';
    batchOk = !!r && r.exitCode === 0;
    logTail(batchOut);
    if (!batchOk && attempt < 2) {
      log('[packages] Batch install failed, retrying once...');
      if (os === 'alpine') await safeExec('rm -f /lib/apk/db/lock', 10000);
      await sleep(3000);
    }
  }

  // 4. Verify against the package database rather than trusting exit codes.
  progress('Verifying installed packages...');
  const verify = async (pkgs: string[]): Promise<Set<string>> => {
    const r = await safeExec(checkCommand(os, pkgs), 30000);
    if (!r) return batchOk ? new Set(pkgs) : new Set();
    return parseInstalledPackageNames(r.output);
  };
  let present = await verify(wanted);
  let missing = wanted.filter(p => !present.has(p));

  // 5. Isolate individual failures and capture the real reason.
  const reasons = new Map<string, string>();
  for (let i = 0; i < missing.length; i++) {
    const pkg = missing[i];
    progress(`Retrying ${pkg} (${i + 1}/${missing.length})...`);
    log(`[packages] Retrying ${pkg}...`);
    const r = await safeExec(addCommand(os, [pkg]), 10 * 60 * 1000);
    if (!r) reasons.set(pkg, 'no response from terminal');
    else if (r.exitCode !== 0) reasons.set(pkg, tailOutput(r.output) || `exit code ${r.exitCode}`);
    logTail(r?.output, 2);
  }
  if (missing.length) {
    present = await verify(wanted);
    missing = wanted.filter(p => !present.has(p));
  }
  const failed = missing.map(pkg => ({
    pkg,
    reason: reasons.get(pkg) || tailOutput(batchOut) || 'not present after install',
  }));
  const installed = wanted.filter(p => present.has(p));

  // 6. Workspace folders. mkdir -p takes multiple args; brace expansion is a
  // bash feature and silently misbehaves under busybox ash.
  progress('Creating workspace folders...');
  const dirs = ['projects', 'downloads', 'scripts', 'documents', 'data', 'tools'].map(d => `/workspace/${d}`).join(' ');
  const mk = await safeExec(`mkdir -p ${dirs}`, 10000);
  if (!mk || mk.exitCode !== 0) {
    warnings.push(`workspace folders: ${tailOutput(mk?.output) || 'no response from terminal'}`);
  }

  log(failed.length
    ? `[packages] Finished: ${installed.length} installed, ${failed.length} failed`
    : `[packages] All ${installed.length} packages installed`);
  progress(failed.length ? 'Finished with errors — see below' : 'Done!');
  return { installed, failed, warnings };
}
