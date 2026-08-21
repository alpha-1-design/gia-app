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

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

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
    setFullInstallProgress('Updating package index...');
    await updatePackageIndex();

    for (let i = 0; i < FULL_INSTALL_PACKAGES.length; i++) {
      const pkg = FULL_INSTALL_PACKAGES[i];
      setFullInstallProgress(`Installing ${pkg} (${i + 1}/${FULL_INSTALL_PACKAGES.length})...`);
      await installPackage(pkg);
    }

    // Create workspace folders
    setFullInstallProgress('Creating workspace folders...');
    await execCommand('mkdir -p /workspace/{projects,downloads,scripts,documents,data,tools}', 10000).catch(() => {});

    setFullInstallProgress('Done!');
    await refreshInstalled();
    setFullInstalling(false);
  }, [execCommand, installPackage, updatePackageIndex, refreshInstalled]);

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
                  <span className="font-semibold text-emerald-300 text-sm">Alpine Linux Installed</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs opacity-70">
                  <div>Rootfs: {(setupStatus.rootfsSizeBytes / 1024 / 1024).toFixed(1)} MB</div>
                  <div>Shell: {setupStatus.hasShell ? '✓' : '✗'}</div>
                  <div>Busybox: {setupStatus.hasBusybox ? '✓' : '✗'}</div>
                  <div>Path: ~/terminal/rootfs</div>
                </div>
                <button
                  onClick={() => startSetup().catch(() => {})}
                  className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Reinstall Rootfs
                </button>
              </div>
            ) : phase === 'idle' || phase === 'error' ? (
              <div className="space-y-3">
                <button
                  onClick={() => startSetup('aarch64').catch(() => {})}
                  disabled={isInstalling}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl p-5 flex flex-col items-center gap-2 transition-colors"
                >
                  <Download className="w-8 h-8" />
                  <span className="text-base font-bold">Install Terminal</span>
                  <span className="text-xs opacity-70">
                    Alpine Linux — ~3MB download, ~50MB on device
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
              {WORKSPACE_FOLDERS.map(folder => (
                <div
                  key={folder.path}
                  className="bg-white/5 rounded-xl p-3 flex items-center gap-2.5"
                >
                  <FolderOpen size={18} className="text-yellow-400/70 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">~/{folder.path}</div>
                    <div className="text-[10px] opacity-40">{folder.desc}</div>
                  </div>
                </div>
              ))}
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
              onClick={refreshInstalled}
              className="w-full text-center text-xs opacity-40 hover:opacity-70 py-2"
            >
              <RefreshCw size={12} className="inline mr-1" /> Refresh
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
