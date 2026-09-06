/**
 * SandboxSetupPanel — On-device terminal setup and package manager.
 *
 * Kai 9000-style: structured sections, full install option, workspace folders,
 * per-session terminal with persistent scrollback.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Terminal, Package, Search, Trash2, RefreshCw,
  CheckCircle2, Loader2, FolderOpen, HardDrive, Cpu,
  ChevronDown, ChevronRight, Zap, Settings, Box,
} from 'lucide-react';
import { useSandboxSetup } from '../hooks/useSandboxSetup';

type Tab = 'system' | 'packages' | 'workspace' | 'mcp';

// ---------------------------------------------------------------------------
// Package categories (Kai-style grouped sections)
// ---------------------------------------------------------------------------

const FULL_INSTALL_PACKAGES = [
  'python3', 'py3-pip', 'nodejs', 'npm', 'git', 'bash',
  'curl', 'wget', 'openssh', 'build-base', 'gcc', 'g++', 'make',
  'vim', 'jq', 'ripgrep', 'tree', 'zip', 'unzip',
  'sqlite', 'ca-certificates',
];

const PACKAGE_SECTIONS = [
  {
    title: 'Languages & Runtimes',
    icon: Cpu,
    packages: [
      { name: 'python3', label: 'Python 3', desc: 'Interpreter + pip' },
      { name: 'py3-pip', label: 'pip', desc: 'Python package manager' },
      { name: 'nodejs', label: 'Node.js', desc: 'JavaScript runtime' },
      { name: 'npm', label: 'npm', desc: 'Node package manager' },
      { name: 'go', label: 'Go', desc: 'Go programming language' },
      { name: 'perl', label: 'Perl', desc: 'Perl interpreter' },
      { name: 'php83', label: 'PHP 8.3', desc: 'PHP interpreter' },
      { name: 'ruby', label: 'Ruby', desc: 'Ruby interpreter' },
    ],
  },
  {
    title: 'Dev Tools',
    icon: Settings,
    packages: [
      { name: 'git', label: 'Git', desc: 'Version control' },
      { name: 'build-base', label: 'Build Tools', desc: 'gcc, g++, make, libc-dev' },
      { name: 'openssh', label: 'OpenSSH', desc: 'SSH client & server' },
      { name: 'vim', label: 'Vim', desc: 'Text editor' },
      { name: 'nano', label: 'Nano', desc: 'Simple text editor' },
      { name: 'bash', label: 'Bash', desc: 'Bourne Again Shell' },
      { name: 'sudo', label: 'Sudo', desc: 'Run as root' },
      { name: 'strace', label: 'strace', desc: 'System call tracer' },
    ],
  },
  {
    title: 'Networking & Web',
    icon: Box,
    packages: [
      { name: 'curl', label: 'cURL', desc: 'HTTP requests' },
      { name: 'wget', label: 'wget', desc: 'File downloader' },
      { name: 'nmap', label: 'Nmap', desc: 'Network scanner' },
      { name: 'bind-tools', label: 'DNS Tools', desc: 'dig, nslookup' },
      { name: 'net-tools', label: 'Net Tools', desc: 'ifconfig, netstat' },
      { name: 'openssl', label: 'OpenSSL', desc: 'TLS/SSL toolkit' },
      { name: 'httpie', label: 'HTTPie', desc: 'User-friendly HTTP client' },
    ],
  },
  {
    title: 'Data & Storage',
    icon: HardDrive,
    packages: [
      { name: 'sqlite', label: 'SQLite', desc: 'Embedded database' },
      { name: 'redis', label: 'Redis', desc: 'In-memory data store' },
      { name: 'jq', label: 'jq', desc: 'JSON processor' },
      { name: 'ripgrep', label: 'Ripgrep', desc: 'Fast text search' },
      { name: 'fd', label: 'fd', desc: 'Fast find' },
    ],
  },
  {
    title: 'Media & Files',
    icon: FolderOpen,
    packages: [
      { name: 'ffmpeg', label: 'FFmpeg', desc: 'Audio/video processing' },
      { name: 'ImageMagick', label: 'ImageMagick', desc: 'Image processing' },
      { name: 'tree', label: 'Tree', desc: 'Directory tree viewer' },
      { name: 'zip', label: 'zip', desc: 'ZIP archiver' },
      { name: 'unzip', label: 'unzip', desc: 'ZIP extractor' },
      { name: 'rsync', label: 'rsync', desc: 'File sync' },
      'aria2', 'lsof',
    ],
  },
];

// Workspace folders to create on setup
const WORKSPACE_FOLDERS = [
  { path: 'projects', label: 'Projects', desc: 'Your code projects' },
  { path: 'downloads', label: 'Downloads', desc: 'Downloaded files' },
  { path: 'scripts', label: 'Scripts', desc: 'Shell scripts & automation' },
  { path: 'documents', label: 'Documents', desc: 'Text files & notes' },
  { path: 'data', label: 'Data', desc: 'Datasets & databases' },
  { path: 'tools', label: 'Tools', desc: 'Custom binaries & tools' },
];

const MCP_CATALOG = [
  { name: 'filesystem', label: 'Filesystem', desc: 'Read/write local files', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem' },
  { name: 'github', label: 'GitHub', desc: 'GitHub API integration', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github' },
  { name: 'postgres', label: 'PostgreSQL', desc: 'Database queries', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres' },
  { name: 'brave-search', label: 'Brave Search', desc: 'Web search via Brave API', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search' },
  { name: 'memory', label: 'Memory', desc: 'Persistent knowledge graph', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory' },
  { name: 'puppeteer', label: 'Puppeteer', desc: 'Browser automation', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer' },
  { name: 'sqlite', label: 'SQLite MCP', desc: 'Local SQLite database', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite' },
  { name: 'fetch', label: 'Fetch', desc: 'HTTP fetching with rendering', url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SandboxSetupPanel() {
  const {
    isNative, setupStatus, phase, progress, log,
    isInstalling, pkgInstalling,
    startSetup, execCommand, installPackage, removePackage, searchPackages,
    listInstalledPackages, updatePackageIndex,
  } = useSandboxSetup();

  const [tab, setTab] = useState<Tab>('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [installedPkgs, setInstalledPkgs] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [fullInstalling, setFullInstalling] = useState(false);
  const [fullInstallProgress, setFullInstallProgress] = useState('');
  const [fullInstallFailures, setFullInstallFailures] = useState<string[]>([]);
  const [selectedOS, setSelectedOS] = useState<'alpine' | 'ubuntu'>('alpine');
  const [workspaceInfo, setWorkspaceInfo] = useState<Record<string, { exists: boolean; count: number }>>({});
  const [workspaceInfoLoading, setWorkspaceInfoLoading] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // selectedOS used to only ever start at 'alpine' and had no way to reflect
  // reality once something was installed -- the OS picker was hidden entirely
  // in the installed state (see JSX below), so if you'd installed Ubuntu,
  // "Reinstall Rootfs" would silently reinstall Alpine instead (the unchanged
  // default), and there was no way to see or switch which distro was active.
  useEffect(() => {
    if (setupStatus?.os && setupStatus.os !== 'unknown') {
      setSelectedOS(setupStatus.os);
    }
  }, [setupStatus?.os]);

  // The workspace folder tiles used to be static labels with no connection
  // to what's actually on disk. Read real state instead: does each folder
  // exist, and how many entries does it have.
  const refreshWorkspaceInfo = useCallback(async () => {
    if (!setupStatus?.installed) return;
    setWorkspaceInfoLoading(true);
    try {
      const cmd = WORKSPACE_FOLDERS.map(f =>
        `if [ -d /workspace/${f.path} ]; then echo "${f.path}:EXISTS:$(ls -1 /workspace/${f.path} 2>/dev/null | wc -l)"; else echo "${f.path}:MISSING:0"; fi`
      ).join('; ');
      const result = await execCommand(cmd, 10000);
      const info: Record<string, { exists: boolean; count: number }> = {};
      (result?.output || '').split('\n').forEach(line => {
        const m = line.trim().match(/^([\w-]+):(EXISTS|MISSING):(\d+)$/);
        if (m) info[m[1]] = { exists: m[2] === 'EXISTS', count: parseInt(m[3], 10) || 0 };
      });
      setWorkspaceInfo(info);
    } catch {
      // Leave workspaceInfo as-is (tiles fall back to "unknown" state) --
      // this is read-only diagnostic info, not worth surfacing an error for.
    } finally {
      setWorkspaceInfoLoading(false);
    }
  }, [execCommand, setupStatus?.installed]);

  useEffect(() => {
    if (tab === 'workspace') refreshWorkspaceInfo();
  }, [tab, refreshWorkspaceInfo]);

  const refreshInstalled = useCallback(async () => {
    const result = await listInstalledPackages();
    if (result && result.exitCode === 0) {
      setInstalledPkgs(result.output.split('\n').filter(Boolean));
    }
  }, [listInstalledPackages]);

  const toggleSection = useCallback((idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  // Full install handler
  const handleFullInstall = useCallback(async () => {
    setFullInstalling(true);
    setFullInstallFailures([]);

    // apk needs to resolve dl-cdn.alpinelinux.org to install anything.
    // Nothing else in this flow configures DNS inside the sandbox, so every
    // apk add here was silently failing on a fresh rootfs (this is the same
    // step SandboxEnvService.provision() does on the Security/Sandbox page,
    // which is why that path worked while this one didn't).
    setFullInstallProgress('Configuring DNS...');
    const dnsResult = await execCommand(
      "test -f /etc/resolv.conf || (echo nameserver 8.8.8.8 > /etc/resolv.conf && echo nameserver 1.1.1.1 >> /etc/resolv.conf)",
      15000,
    ).catch(() => null);
    if (!dnsResult || dnsResult.exitCode !== 0) {
      setFullInstallFailures(prev => [...prev, `DNS setup: ${dnsResult?.output?.trim() || 'no response from terminal'}`]);
    }

    setFullInstallProgress('Updating package index...');
    const indexResult = await updatePackageIndex();
    if (!indexResult || indexResult.exitCode !== 0) {
      setFullInstallFailures(prev => [...prev, `package index update: ${indexResult?.output?.trim() || 'no response from terminal'}`]);
    }

    const failed: string[] = [];
    for (let i = 0; i < FULL_INSTALL_PACKAGES.length; i++) {
      const pkg = FULL_INSTALL_PACKAGES[i];
      setFullInstallProgress(`Installing ${pkg} (${i + 1}/${FULL_INSTALL_PACKAGES.length})...`);
      const result = await installPackage(pkg);
      if (!result || result.exitCode !== 0) {
        failed.push(pkg);
      }
    }
    if (failed.length) {
      setFullInstallFailures(prev => [...prev, `packages that failed to install: ${failed.join(', ')}`]);
    }

    // Create workspace folders. mkdir -p takes multiple directory arguments
    // directly -- brace expansion like /workspace/{a,b,c} is a bash feature
    // and silently no-ops (creates one literally-named directory) under the
    // busybox ash shell this runs in, so folders never actually get made.
    setFullInstallProgress('Creating workspace folders...');
    const workspaceDirs = ['projects', 'downloads', 'scripts', 'documents', 'data', 'tools']
      .map(d => `/workspace/${d}`).join(' ');
    const mkdirResult = await execCommand(`mkdir -p ${workspaceDirs}`, 10000).catch(() => null);
    if (!mkdirResult || mkdirResult.exitCode !== 0) {
      setFullInstallFailures(prev => [...prev, `workspace folders: ${mkdirResult?.output?.trim() || 'no response from terminal'}`]);
    }

    setFullInstallProgress(failed.length ? 'Finished with errors — see below' : 'Done!');
    await refreshInstalled();
    await refreshWorkspaceInfo();
    setFullInstalling(false);
  }, [execCommand, installPackage, updatePackageIndex, refreshInstalled, refreshWorkspaceInfo]);

  // Single package install
  const handleInstall = useCallback(async (pkg: string) => {
    await installPackage(pkg);
    await refreshInstalled();
  }, [installPackage, refreshInstalled]);

  const handleRemove = useCallback(async (pkg: string) => {
    await removePackage(pkg);
    await refreshInstalled();
  }, [removePackage, refreshInstalled]);

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const result = await searchPackages(searchQuery);
    if (result && result.exitCode === 0) {
      setSearchResults(result.output.split('\n').filter(Boolean));
    }
  }, [searchQuery, searchPackages]);

  const isPkgInstalled = useCallback((name: string) => {
    return installedPkgs.some(p => p.startsWith(name + ' ') || p === name);
  }, [installedPkgs]);

  // Not native
  if (!isNative) {
    return (
      <div className="p-6 text-center">
        <Terminal className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <h3 className="text-lg font-semibold mb-2">Terminal</h3>
        <p className="text-sm opacity-60">
          On-device terminal is available on Android.
          On web, GIA uses a sandbox server.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ─── HEADER TABS ─── */}
      <div className="flex border-b border-white/10">
        {([
          { id: 'system' as Tab, icon: Cpu, label: 'System' },
          { id: 'packages' as Tab, icon: Package, label: 'Packages' },
          { id: 'workspace' as Tab, icon: FolderOpen, label: 'Files' },
          { id: 'mcp' as Tab, icon: Zap, label: 'MCPs' },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setTab(id); if (id === 'packages' || id === 'workspace') refreshInstalled(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
              tab === id ? 'text-purple-400 border-b-2 border-purple-400' : 'opacity-50 hover:opacity-80'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ═══════ SYSTEM TAB ═══════ */}
        {tab === 'system' && (
          <>
            {/* Status */}
            {setupStatus?.installed ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-400" size={18} />
                  <span className="font-semibold text-emerald-300 text-sm">
                    {setupStatus.os === 'ubuntu' ? '🐧 Ubuntu 24.04' : '🏔 Alpine Linux'} Installed
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs opacity-70">
                  <div>Rootfs: {(setupStatus.rootfsSizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  <div>Shell: {setupStatus.hasShell ? '✓' : '✗'}</div>
                  <div>Busybox: {setupStatus.hasBusybox ? '✓' : '✗ (n/a on Ubuntu)'}</div>
                  <div>Path: ~/terminal/rootfs</div>
                </div>
                <button
                  onClick={() => startSetup('aarch64', selectedOS).catch(() => {})}
                  className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Reinstall {selectedOS === 'ubuntu' ? 'Ubuntu' : 'Alpine'}
                </button>

                {/* Switch distro -- was previously impossible once installed:
                    the whole picker below was hidden in this branch. */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-wide opacity-40">Switch Linux distribution</div>
                  <div className="flex rounded-xl overflow-hidden border border-white/10">
                    <button
                      onClick={() => setSelectedOS('alpine')}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        selectedOS === 'alpine' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:text-white/70'
                      }`}
                    >
                      🏔 Alpine
                    </button>
                    <button
                      onClick={() => setSelectedOS('ubuntu')}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        selectedOS === 'ubuntu' ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/50 hover:text-white/70'
                      }`}
                    >
                      🐧 Ubuntu
                    </button>
                  </div>
                  {selectedOS !== setupStatus.os && (
                    <button
                      onClick={() => startSetup('aarch64', selectedOS).catch(() => {})}
                      className="w-full text-xs rounded-lg py-2 bg-white/10 hover:bg-white/15 transition-colors"
                    >
                      Install {selectedOS === 'ubuntu' ? 'Ubuntu' : 'Alpine'} instead (replaces current rootfs)
                    </button>
                  )}
                </div>
              </div>
            ) : phase === 'idle' || phase === 'error' ? (
              <div className="space-y-3">
                {/* OS Selector */}
                <div className="flex rounded-xl overflow-hidden border border-white/10">
                  <button
                    onClick={() => setSelectedOS('alpine')}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                      selectedOS === 'alpine'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-white/50 hover:text-white/70'
                    }`}
                  >
                    🏔 Alpine Linux
                  </button>
                  <button
                    onClick={() => setSelectedOS('ubuntu')}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                      selectedOS === 'ubuntu'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white/5 text-white/50 hover:text-white/70'
                    }`}
                  >
                    🐧 Ubuntu 24.04
                  </button>
                </div>
                <button
                  onClick={() => startSetup('aarch64', selectedOS).catch(() => {})}
                  disabled={isInstalling}
                  className={`w-full rounded-xl p-5 flex flex-col items-center gap-2 transition-colors ${
                    selectedOS === 'ubuntu'
                      ? 'bg-orange-600 hover:bg-orange-500 disabled:opacity-50'
                      : 'bg-purple-600 hover:bg-purple-500 disabled:opacity-50'
                  }`}
                >
                  <Download className="w-8 h-8" />
                  <span className="text-base font-bold">
                    Install {selectedOS === 'ubuntu' ? 'Ubuntu' : 'Alpine'}
                  </span>
                  <span className="text-xs opacity-70">
                    {selectedOS === 'ubuntu'
                      ? 'Ubuntu 24.04 — ~28MB download, full Debian-compatible package manager'
                      : 'Alpine Linux — ~3MB download, lightweight with apk package manager'
                    }
                  </span>
                </button>
              </div>
            ) : null}

            {/* Full Install — only shown after rootfs is ready */}
            {setupStatus?.installed && !fullInstalling && (
              <button
                onClick={handleFullInstall}
                className="w-full bg-violet-600/80 hover:bg-violet-500/80 rounded-xl p-4 flex items-center gap-3 transition-colors"
              >
                <Zap className="w-6 h-6 text-violet-300" />
                <div className="text-left">
                  <div className="text-sm font-bold">Full Install</div>
                  <div className="text-xs opacity-70">
                    Installs Python, Node.js, Git, build tools, and creates workspace folders
                  </div>
                </div>
              </button>
            )}

            {/* Full install progress */}
            {fullInstalling && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="text-violet-400 animate-spin" size={16} />
                  <span className="text-sm font-medium text-violet-300">Installing packages...</span>
                </div>
                <p className="text-xs opacity-60 font-mono">{fullInstallProgress}</p>
              </div>
            )}

            {/* Full install failures — surfaced instead of silently swallowed */}
            {!fullInstalling && fullInstallFailures.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
                <span className="text-sm font-medium text-red-300">Full install finished with errors</span>
                {fullInstallFailures.map((f, i) => (
                  <p key={i} className="text-xs opacity-70 font-mono break-words">{f}</p>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {(phase === 'downloading' || phase === 'extracting' || phase === 'materializing' || phase === 'installing' || phase === 'verifying') && (
              <div className="space-y-2">
                <div className="bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs opacity-50">
                  <span className="capitalize">{phase}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}

            {/* Live output */}
            {log.length > 0 && (
              <div className="bg-black/30 rounded-xl overflow-hidden">
                <div className="px-4 py-2 text-xs font-medium opacity-50 flex items-center gap-1.5">
                  <Terminal size={12} /> Live Output
                </div>
                <div
                  ref={logRef}
                  className="max-h-56 overflow-y-auto px-4 pb-3 font-mono text-[11px] leading-relaxed"
                >
                  {log.map((line, i) => (
                    <div key={i} className="py-px opacity-60">{line}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════ PACKAGES TAB ═══════ */}
        {tab === 'packages' && (
          <>
            {/* Search bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search Alpine packages..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:opacity-40 focus:outline-none focus:border-purple-400/50"
              />
              <button onClick={handleSearch} className="bg-purple-600 hover:bg-purple-500 rounded-lg px-3 py-2">
                <Search size={16} />
              </button>
            </div>

            {/* Package sections (Kai-style collapsible groups) */}
            {PACKAGE_SECTIONS.map((section, sIdx) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.has(sIdx);
              const installedCount = section.packages.filter(p =>
                typeof p === 'string' ? isPkgInstalled(p) : isPkgInstalled(p.name)
              ).length;

              return (
                <div key={sIdx} className="bg-white/5 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <SectionIcon size={16} className="text-purple-400" />
                      <span className="text-sm font-medium">{section.title}</span>
                      <span className="text-xs opacity-40">
                        {installedCount}/{section.packages.length}
                      </span>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="opacity-40" /> : <ChevronRight size={14} className="opacity-40" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5 px-3 py-2 space-y-1">
                      {section.packages.map(pkg => {
                        const name = typeof pkg === 'string' ? pkg : pkg.name;
                        const label = typeof pkg === 'string' ? pkg : pkg.label;
                        const desc = typeof pkg === 'string' ? '' : pkg.desc;
                        const installed = isPkgInstalled(name);

                        return (
                          <div key={name} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium">{label}</div>
                              {desc && <div className="text-[10px] opacity-40">{desc}</div>}
                            </div>
                            {installed ? (
                              <button
                                onClick={() => handleRemove(name)}
                                className="ml-2 p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                title="Remove"
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleInstall(name)}
                                disabled={pkgInstalling === name}
                                className="ml-2 p-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
                                title="Install"
                              >
                                {pkgInstalling === name ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Download size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="bg-black/30 rounded-xl p-3">
                <h4 className="text-xs font-medium opacity-50 mb-2">Search Results</h4>
                <div className="font-mono text-[11px] max-h-40 overflow-y-auto space-y-px">
                  {searchResults.map((r, i) => (
                    <div key={i} className="py-0.5 opacity-60">{r}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════ WORKSPACE TAB ═══════ */}
        {tab === 'workspace' && (
          <>
            <div className="text-xs opacity-50 mb-2">
              Your terminal workspace. GIA creates organized folders for different types of work.
            </div>

            {/* Folder grid */}
            <div className="grid grid-cols-2 gap-2">
              {WORKSPACE_FOLDERS.map(folder => {
                const info = workspaceInfo[folder.path];
                return (
                  <div
                    key={folder.path}
                    className="bg-white/5 rounded-xl p-3 flex items-center gap-2.5"
                  >
                    <FolderOpen size={18} className={info?.exists ? 'text-yellow-400/70 shrink-0' : 'text-white/20 shrink-0'} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">~/{folder.path}</div>
                      <div className="text-[10px] opacity-40">
                        {workspaceInfoLoading && !info
                          ? 'Checking...'
                          : info === undefined
                          ? folder.desc
                          : info.exists
                          ? `${info.count} item${info.count === 1 ? '' : 's'}`
                          : 'Not created yet'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick info */}
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-semibold opacity-70">Paths</h4>
              <div className="font-mono text-[11px] space-y-1 opacity-50">
                <div>Rootfs:   /data/data/com.alpha1studio.gia/files/terminal/rootfs</div>
                <div>Workspace: /data/data/com.alpha1studio.gia/files/terminal/rootfs/workspace</div>
                <div>Home:     /root (inside sandbox)</div>
              </div>
            </div>

            <button
              onClick={() => { refreshInstalled(); refreshWorkspaceInfo(); }}
              className="w-full text-center text-xs opacity-40 hover:opacity-70 py-2"
            >
              <RefreshCw size={12} className={`inline mr-1 ${workspaceInfoLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </>
        )}

        {/* ═══════ MCP TAB ═══════ */}
        {tab === 'mcp' && (
          <>
            <div className="text-xs opacity-50">
              Model Context Protocol servers — extend GIA with external tool integrations.
            </div>
            <div className="space-y-2">
              {MCP_CATALOG.map(mcp => (
                <div key={mcp.name} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold">{mcp.label}</div>
                    <div className="text-[10px] opacity-40">{mcp.desc}</div>
                  </div>
                  <a
                    href={mcp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/20 whitespace-nowrap"
                  >
                    Source
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
