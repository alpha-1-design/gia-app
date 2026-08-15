import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SubPageHeader } from './SubPageHeader';
import SandboxService from '../../services/SandboxService';
import terminalService, { getSmartTimeout } from '../../services/TerminalService';
import { SandboxEnvService, type SandboxStatus } from '../../services/SandboxEnvService';
import { isNativePlatform } from '../../utils/helpers';
import { useGiaStore } from '../../store/useGiaStore';
import GiaBrain from '../../services/GiaBrain';
import {
  Terminal as TerminalIcon, ShieldCheck, Package, CheckCircle2,
  Copy, Trash2, Maximize2, Minimize2, Play,
  Loader2, Sparkles, Check, AlertCircle, Wrench, RefreshCw
} from 'lucide-react';

interface TerminalLine {
  id: string;
  type: 'cmd' | 'stdout' | 'stderr' | 'info' | 'error' | 'success';
  text: string;
  timestamp: string;
}

const PRESET_COMMANDS = [
  { label: 'System Info', cmd: 'uname -a && cat /etc/os-release 2>/dev/null || echo "Ubuntu/Debian Root Environment"' },
  { label: 'Check Python & Node', cmd: 'python3 --version && node -v && npm -v' },
  { label: 'Check Package Managers', cmd: 'which apt dpkg apk pip npm git 2>/dev/null' },
  { label: 'Memory & Storage', cmd: 'free -h 2>/dev/null || free -m; echo "---"; df -h .' },
  { label: 'Root Privileges', cmd: 'whoami && id' },
  { label: 'List Root Files', cmd: 'ls -la /' },
  { label: 'Network Test', cmd: 'curl -I https://google.com 2>&1 | head -n 5' },
];

export const TerminalPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const addNotification = useGiaStore((s) => s.addNotification);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'terminal' | 'packages' | 'ai-access'>('terminal');

  // Terminal state
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      type: 'info',
      text: '══════════════════════════════════════════════════════════════════════',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-2',
      type: 'success',
      text: '   root@gia-ubuntu-terminal:~# Fresh Debian/Ubuntu Root Shell Loaded',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-3',
      type: 'info',
      text: '   Pre-installed stack: Python 3, Node.js, npm, Git, GCC/G++, Curl, Bash',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-4',
      type: 'info',
      text: '   AI Agent Bridge: Active & Connected (terminal_run, code_execution)',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-5',
      type: 'info',
      text: '══════════════════════════════════════════════════════════════════════\nType any bash command below or select a quick preset.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [executing, setExecuting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Environment & Package status
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionLog, setProvisionLog] = useState('');

  // AI Access settings
  const [aiAccessEnabled, setAiAccessEnabled] = useState(true);
  const [autoInstallPkgs, setAutoInstallPkgs] = useState(true);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isNative = isNativePlatform();

  // Refresh package status
  const refreshStatus = useCallback(async () => {
    try {
      const s = await SandboxEnvService.status();
      setSandboxStatus(s);
    } catch (e) {
      console.warn('Failed to fetch sandbox status:', e);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, activeTab]);

  // Focus input on tab switch
  useEffect(() => {
    if (activeTab === 'terminal') {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  // Execute command or route to GIA AI chat
  const runCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : inputCommand).trim();
    if (!cmd || executing) return;

    if (cmd.toLowerCase() === 'clear') {
      setLines([]);
      setInputCommand('');
      return;
    }

    const timeStr = new Date().toLocaleTimeString();
    const cmdLineId = `cmd-${Date.now()}`;

    // Add command line to terminal
    setLines((prev) => [
      ...prev,
      {
        id: cmdLineId,
        type: 'cmd',
        text: `root@gia-terminal:~# ${cmd}`,
        timestamp: timeStr,
      },
    ]);

    if (!cmdToRun) {
      setHistory((prev) => [cmd, ...prev.filter((h) => h !== cmd)]);
      setHistoryIndex(-1);
      setInputCommand('');
    }

    setExecuting(true);

    // AI Chat Intent Detection (Claude Code / OpenCode style)
    const lowerCmd = cmd.toLowerCase();
    const isAiPrompt =
      lowerCmd.startsWith('gia ') ||
      lowerCmd.startsWith('ai ') ||
      lowerCmd.startsWith('@gia ') ||
      lowerCmd.startsWith('ask ') ||
      lowerCmd.startsWith('explain ') ||
      lowerCmd.startsWith('how to ') ||
      lowerCmd.startsWith('build ') ||
      lowerCmd.startsWith('create ');

    if (isAiPrompt) {
      const cleanPrompt = cmd
        .replace(/^(gia|ai|@gia|ask)\s+/i, '')
        .trim();

      const resLineId = `ai-res-${Date.now()}`;
      setLines((prev) => [
        ...prev,
        {
          id: resLineId,
          type: 'info',
          text: '🤖 GIA: Thinking...',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      try {
        let accumulated = '';
        await GiaBrain.generate({
          prompt: `User chatted directly in GIA Terminal: ${cleanPrompt}\nProvide a clear, concise terminal response. If bash execution or building is needed, feel free to suggest or execute commands.`,
          onStream: (chunk: string) => {
            accumulated += chunk;
            setLines((prev) =>
              prev.map((l) =>
                l.id === resLineId
                  ? { ...l, text: `🤖 GIA: ${accumulated}` }
                  : l
              )
            );
          },
        });
      } catch (e) {
        const errText = e instanceof Error ? e.message : String(e);
        setLines((prev) =>
          prev.map((l) =>
            l.id === resLineId
              ? { ...l, type: 'error', text: `🤖 GIA Error: ${errText}` }
              : l
          )
        );
      } finally {
        setExecuting(false);
      }
      return;
    }

    try {
      let outputText = '';
      let isErr = false;

      const effectiveTimeoutMs = getSmartTimeout(cmd, timeoutSeconds * 1000);

      // Try execution backends: 1. SandboxService (Web/Container), 2. TerminalService (Native proot)
      if (terminalService.isAvailable()) {
        const res = await terminalService.exec(cmd, undefined, undefined, effectiveTimeoutMs);
        outputText = res.output || '(command executed with no output)';
        isErr = res.exitCode !== 0;
      } else {
        const res = await SandboxService.exec(cmd, { timeout: effectiveTimeoutMs });
        const stdout = res.stdout?.trim();
        const stderr = res.stderr?.trim();
        if (stdout && stderr) {
          outputText = `${stdout}\n[stderr]\n${stderr}`;
        } else {
          outputText = stdout || stderr || '(command executed with no output)';
        }
        isErr = res.exitCode !== 0;
      }

      setLines((prev) => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          type: isErr ? 'error' : 'stdout',
          text: outputText,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setLines((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: 'error',
          text: `[Error]: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  // Keyboard history navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCommand(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      }
    }
  };

  const copyTerminalOutput = () => {
    const text = lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification('Terminal output copied to clipboard');
  };

  // Provision environment action
  const handleProvision = async () => {
    setProvisioning(true);
    setProvisionLog('Starting Debian/Ubuntu root package installation...\n');
    try {
      const res = await SandboxEnvService.provision((msg) => {
        setProvisionLog((prev) => prev + `• ${msg}\n`);
      });
      setProvisionLog((prev) => prev + `\n${res.output}\nFinished.`);
      await refreshStatus();
      addNotification(res.success ? 'Debian/Ubuntu environment provisioned successfully!' : 'Environment setup completed with notices.');
    } catch (e) {
      setProvisionLog((prev) => prev + `\n[Error]: ${e instanceof Error ? e.message : String(e)}`);
      addNotification('Environment setup encountered an error');
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto ${fullscreen ? 'fixed inset-0 z-50 p-4' : 'p-4'}`}
      style={{ background: 'var(--gia-bg)', gap: '16px' }}
    >
      <SubPageHeader title="Root Terminal & Linux Shell" onBack={onBack} />

      {/* Header Banner */}
      <div
        className="gia-card p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.05) 100%)',
          borderColor: 'rgba(16,185,129,0.25)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#0d0d14', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
            >
              <TerminalIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: 'var(--gia-text)' }}>
                  {isNative ? 'Ubuntu / Debian Root Environment' : 'Linux Container Root Shell'}
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  root@gia-terminal
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                Full interactive shell with pre-installed Python, Node.js, Git, GCC/G++ & direct AI access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <ShieldCheck size={13} /> AI Access Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--gia-border)' }}>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'terminal' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TerminalIcon size={14} /> Interactive Shell
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'packages' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Package size={14} /> Pre-installed Packages
        </button>
        <button
          onClick={() => setActiveTab('ai-access')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'ai-access' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles size={14} /> AI Permissions
        </button>
      </div>

      {/* Tab 1: Interactive Shell */}
      {activeTab === 'terminal' && (
        <div className="flex flex-col gap-3 flex-1">
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-semibold shrink-0" style={{ color: 'var(--gia-muted)' }}>
              Presets:
            </span>
            {PRESET_COMMANDS.map((p, i) => (
              <button
                key={i}
                onClick={() => runCommand(p.cmd)}
                disabled={executing}
                className="px-2.5 py-1 rounded-md text-[11px] font-mono shrink-0 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-300 border border-white/10 transition-colors disabled:opacity-50"
                style={{ color: 'var(--gia-text)' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Terminal Console Window */}
          <div
            className="rounded-xl p-3 flex flex-col font-mono text-xs shadow-xl border overflow-hidden min-h-[360px] max-h-[600px]"
            style={{ background: '#0a0a0f', borderColor: 'rgba(16,185,129,0.2)' }}
          >
            {/* Terminal Top Window Controls */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[11px] text-zinc-400 font-sans ml-2">bash — root@gia-terminal:~#</span>
              </div>

              <div className="flex items-center gap-2 font-sans">
                <button
                  onClick={copyTerminalOutput}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Copy terminal output"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <button
                  onClick={() => setLines([])}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                  title="Clear screen"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>

            {/* Output log */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-text">
              {lines.map((l) => (
                <div
                  key={l.id}
                  className={`whitespace-pre-wrap break-words ${
                    l.type === 'cmd'
                      ? 'text-emerald-400 font-bold'
                      : l.type === 'error'
                      ? 'text-rose-400'
                      : l.type === 'success'
                      ? 'text-emerald-300'
                      : l.type === 'info'
                      ? 'text-cyan-300'
                      : 'text-zinc-300'
                  }`}
                >
                  {l.text}
                </div>
              ))}
              {executing && (
                <div className="flex items-center gap-2 text-amber-400 animate-pulse pt-1">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Executing command in root environment...</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/10 shrink-0">
              <span className="text-emerald-400 font-bold shrink-0">root@gia-terminal:~#</span>
              <input
                ref={inputRef}
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={executing}
                placeholder="type bash command (e.g., python3 script.py, apt update)..."
                className="flex-1 bg-transparent border-none outline-none text-emerald-300 placeholder-zinc-600 font-mono text-xs"
              />
              <button
                onClick={() => runCommand()}
                disabled={executing || !inputCommand.trim()}
                className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-sans flex items-center gap-1 disabled:opacity-40 transition-colors"
              >
                <Play size={11} /> Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Pre-installed Packages */}
      {activeTab === 'packages' && (
        <div className="flex flex-col gap-4">
          <div className="gia-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>
                  Pre-installed Environment Packages
                </h3>
              </div>
              <button
                onClick={refreshStatus}
                className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                title="Refresh Status"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--gia-muted)' }}>
              All essential developer runtimes and tools are installed directly into the root Linux environment so both you and GIA can build, test, and run code instantly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'Python 3', key: 'python3', desc: 'Python runtime, pip package manager, virtualenv' },
                { name: 'Node.js', key: 'node', desc: 'JavaScript/TypeScript runtime & V8 engine' },
                { name: 'npm', key: 'npm', desc: 'Node Package Manager & global CLI dependencies' },
                { name: 'Git & Bash', key: 'git', desc: 'Version control, shell scripts & git repository tools' },
                { name: 'GCC / G++ / Make', key: 'gcc', desc: 'C/C++ compilation toolchain & build-base utilities' },
              ].map((item) => {
                const pkgInfo = sandboxStatus?.packages.find((p) => p.key === item.key);
                const isOk = pkgInfo?.ok;
                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl border flex items-start gap-3"
                    style={{
                      background: isOk ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                      borderColor: isOk ? 'rgba(16,185,129,0.2)' : 'var(--gia-border)',
                    }}
                  >
                    <div className="mt-0.5">
                      {isOk ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: 'var(--gia-text)' }}>
                          {item.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {pkgInfo ? (pkgInfo.version || 'unavailable') : 'checking...'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--gia-muted)' }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t flex flex-wrap gap-3 items-center justify-between" style={{ borderColor: 'var(--gia-border)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                  Provision / Upgrade Environment
                </p>
                <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
                  Runs apt/apk package updates and installs missing tools.
                </p>
              </div>

              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {provisioning ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                {provisioning ? 'Installing Packages...' : 'Provision / Update All'}
              </button>
            </div>

            {provisionLog && (
              <div className="mt-3 p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-zinc-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {provisionLog}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: AI Permissions */}
      {activeTab === 'ai-access' && (
        <div className="flex flex-col gap-4">
          <div className="gia-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-purple-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--gia-text)' }}>
                AI Agent Terminal Integration
              </h3>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--gia-muted)' }}>
              GIA uses tools like <code className="text-emerald-400">terminal_run</code>, <code className="text-emerald-400">code_execution</code>, and <code className="text-emerald-400">sandbox_exec</code> to inspect files, execute code, install dependencies, and analyze data on your command.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                    Allow Direct Terminal Execution
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
                    GIA can execute shell scripts and python programs in the root terminal
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={aiAccessEnabled}
                  onChange={(e) => setAiAccessEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                    Auto-Install Missing Packages
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>
                    GIA can automatically run <code className="text-emerald-400">pip install</code> or <code className="text-emerald-400">npm install</code> if a script requires packages
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoInstallPkgs}
                  onChange={(e) => setAutoInstallPkgs(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                    Command Execution Timeout
                  </p>
                  <span className="text-xs font-mono text-emerald-400">{timeoutSeconds} seconds</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
