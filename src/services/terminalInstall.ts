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

/**
 * Alpine mirrors (CDN first, then a couple of well-known regional ones) tried
 * in order until one actually answers. Nothing in the old flow checked
 * reachability before installing — it just ran `apk update` against whatever
 * /etc/apk/repositories already had and let that single mirror's failure take
 * the whole install down.
 */
export const ALPINE_MIRRORS = [
  'https://dl-cdn.alpinelinux.org/alpine',
  'https://mirror.leaseweb.com/alpine',
  'https://alpine.global.ssl.fastly.net/alpine',
];

/** `/etc/alpine-release` looks like "3.21.0". Extract the release branch, e.g. "v3.21". */
function alpineBranchCommand(): string {
  return "cat /etc/alpine-release 2>/dev/null | cut -d. -f1,2 | sed 's/^/v/' || echo v3.21";
}

/**
 * Pick the first Alpine mirror that actually responds and write it into
 * /etc/apk/repositories, instead of discovering a dead mirror only after
 * `apk update` has already failed partway through Full Install.
 */
export async function selectReachableMirror(exec: ExecFn, log: (line: string) => void): Promise<{ mirror: string; reachable: boolean }> {
  const branchRes = await exec(alpineBranchCommand(), 5000).catch(() => null);
  const branch = (branchRes?.output || 'v3.21').trim().split('\n').pop() || 'v3.21';

  for (const mirror of ALPINE_MIRRORS) {
    log(`[packages] Testing mirror ${mirror}...`);
    // Ask the on-device shell for its own architecture rather than the JS
    // runtime's (this code runs in a WebView, not Node — there is no global
    // `process`, and even if there were, the host device's arch is what
    // matters here, not the one running this JS).
    const probe = await exec(
      `wget -q -T 8 -t 1 -O /dev/null '${mirror}/${branch}/main/'"$(uname -m)"'/APKINDEX.tar.gz' && echo REACHABLE`,
      12000,
    ).catch(() => null);
    if (probe?.output.includes('REACHABLE')) {
      log(`[packages] Using mirror ${mirror}`);
      await exec(
        `printf '%s\\n%s\\n' '${mirror}/${branch}/main' '${mirror}/${branch}/community' > /etc/apk/repositories`,
        5000,
      ).catch(() => null);
      return { mirror, reachable: true };
    }
    log(`[packages] ${mirror} did not respond, trying the next one...`);
  }
  log('[packages] No mirror responded — continuing with the configured repositories');
  return { mirror: ALPINE_MIRRORS[0], reachable: false };
}

/**
 * Packages whose presence we can confirm by actually running them, which is
 * ground truth that can't be fooled by a package-database record left behind
 * by an interrupted install. Keyed by the Alpine package name.
 */
const BINARY_CHECKS: Record<string, string> = {
  nodejs: 'node --version', git: 'git --version', python3: 'python3 --version',
  'build-base': 'gcc --version', npm: 'npm --version',
};

const PROOT_FAILURE = /fatal error|libproot|proot (error|warning)|No such file or directory|can't chdir/i;

/**
 * Re-check packages the install reported as present against the one that
 * actually matters: does the binary run. A package can be "installed" in
 * apk's database (`apk info -e` says yes) because an interrupted install left
 * a partial record, while the real binary is missing or broken — which is
 * exactly the gap between what Full Install reports and what Settings → Mical
 * reports, with no explanation for why they disagree.
 */
export async function verifyBinaries(exec: ExecFn, installed: string[]): Promise<{ confirmed: string[]; broken: { pkg: string; reason: string }[] }> {
  const confirmed: string[] = [];
  const broken: { pkg: string; reason: string }[] = [];
  for (const pkg of installed) {
    const check = BINARY_CHECKS[pkg];
    if (!check) { confirmed.push(pkg); continue; }
    const r = await exec(`${check} 2>&1`, 15000).catch(() => null);
    const line = (r?.output || '').trim().split('\n').pop()?.trim() || '';
    if (r && r.exitCode === 0 && line && !/not found|command not found/i.test(line) && !PROOT_FAILURE.test(line)) {
      confirmed.push(pkg);
    } else {
      broken.push({ pkg, reason: `apk shows it installed, but the binary doesn't run: ${line || 'no output'}` });
    }
  }
  return { confirmed, broken };
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

function upgradeCommand(os: DistroOs): string {
  return os === 'ubuntu'
    ? 'DEBIAN_FRONTEND=noninteractive apt-get -o APT::Sandbox::User=root upgrade -y 2>&1'
    : 'apk upgrade --no-cache --no-progress 2>&1';
}

export interface UpdatePackagesResult {
  ok: boolean;
  /** Short, user-facing summary of what happened (e.g. "7 packages upgraded" or "already up to date"). */
  summary: string;
  warnings: string[];
}

/**
 * Update every already-installed package to its latest available version.
 * There was no way to do this at all before — Packages tab only had one-way
 * "install" buttons, nothing to check for or apply updates afterward.
 */
export async function runUpdatePackages(deps: FullInstallDeps): Promise<UpdatePackagesResult> {
  const { os, exec } = deps;
  const progress = deps.onProgress ?? (() => {});
  const log = deps.onLog ?? (() => {});
  const sleep = deps.sleep ?? realSleep;
  const warnings: string[] = [];
  const safeExec = (cmd: string, timeout: number) => exec(cmd, timeout).catch(() => null);

  if (os === 'alpine') {
    await safeExec('rm -f /lib/apk/db/lock', 10000);
  } else {
    await safeExec('rm -f /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock', 10000);
  }

  if (os === 'alpine') {
    progress('Finding a reachable mirror...');
    const { reachable } = await selectReachableMirror(exec, log);
    if (!reachable) warnings.push('No Alpine mirror responded; continuing with the configured repositories');
  }

  progress('Updating package index...');
  log('[packages] Updating package index...');
  let indexOk = false;
  let indexOut = '';
  for (let attempt = 1; attempt <= 3 && !indexOk; attempt++) {
    const r = await safeExec(updateCommand(os), 120000);
    indexOut = r?.output ?? '';
    indexOk = !!r && r.exitCode === 0;
    if (!indexOk && attempt < 3) await sleep(2000 * attempt);
  }
  if (!indexOk) {
    return { ok: false, summary: `Couldn't reach the package index: ${tailOutput(indexOut) || 'no response from terminal'}`, warnings };
  }

  progress('Checking for updates...');
  log('[packages] Checking for updates...');
  const r = await safeExec(upgradeCommand(os), 20 * 60 * 1000);
  const out = r?.output ?? '';
  (out.split('\n').map(l => l.trim()).filter(Boolean).slice(-6)).forEach(l => log(`[packages] ${l}`));

  if (!r) {
    return { ok: false, summary: 'No response from the terminal', warnings };
  }
  if (r.exitCode !== 0) {
    return { ok: false, summary: `Update failed: ${tailOutput(out) || `exit code ${r.exitCode}`}`, warnings };
  }

  const upgraded = os === 'alpine'
    ? (out.match(/^Upgrading /m) ? out.split('\n').filter(l => /^\S+-\S+ -> \S+/.test(l.trim()) || /^Upgrading /.test(l)).length : 0)
    : (out.match(/(\d+) upgraded/)?.[1] ? Number(out.match(/(\d+) upgraded/)?.[1]) : 0);

  progress('Done!');
  log(upgraded > 0 ? `[packages] ${upgraded} package(s) upgraded` : '[packages] Already up to date');
  return {
    ok: true,
    summary: upgraded > 0 ? `${upgraded} package${upgraded === 1 ? '' : 's'} upgraded` : 'Already up to date',
    warnings,
  };
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

  // 2. Find a mirror that actually answers before touching the package
  // index — the old flow discovered a dead mirror only via a failed `apk
  // update`, with no indication that the mirror itself was the problem.
  if (os === 'alpine') {
    progress('Finding a reachable mirror...');
    const { mirror, reachable } = await selectReachableMirror(exec, log);
    if (!reachable) warnings.push(`No Alpine mirror responded (tried ${ALPINE_MIRRORS.length}); continuing with ${mirror} anyway`);
  }

  // 3. Package index, with retries.
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
  let installed = wanted.filter(p => present.has(p));

  // 6. Confirm the packages apk's database calls "installed" actually work.
  // This is what makes Full Install's own completion report agree with what
  // Settings -> Mical shows, instead of the two silently disagreeing.
  progress('Confirming installed tools actually run...');
  const { confirmed, broken } = await verifyBinaries(exec, installed);
  installed = confirmed;
  failed.push(...broken);

  // 7. Workspace folders. mkdir -p takes multiple args; brace expansion is a
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
