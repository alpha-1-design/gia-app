/**
 * useSandboxSetup — TypeScript bridge for on-device terminal setup.
 *
 * Provides real-time progress from the native GIATerminal plugin during
 * Alpine rootfs download, extraction, and package installation.
 * Kai 9000-style: everything happens on the user's device with visible logs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupPhase = 'idle' | 'downloading' | 'extracting' | 'materializing' | 'installing' | 'verifying' | 'ready' | 'error';

export interface ProgressEvent {
  phase: SetupPhase;
  progress: number;      // 0-100
  message: string;
  timestamp: number;
}

export interface SetupStatus {
  installed: boolean;
  rootfsPath: string;
  rootfsSizeBytes: number;
  hasBusybox: boolean;
  hasShell: boolean;
}

export interface PackageCmdResult {
  output: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Native plugin interface
// ---------------------------------------------------------------------------

interface GIASetupPlugin {
  downloadRootfs(opts: { arch?: string; archId?: number }): Promise<{ success: boolean; message: string }>;
  exec(opts: { command: string; timeout?: number }): Promise<PackageCmdResult>;
  installPackage(opts: { packageName: string }): Promise<PackageCmdResult>;
  removePackage(opts: { packageName: string }): Promise<PackageCmdResult>;
  searchPackages(opts: { query: string }): Promise<PackageCmdResult>;
  listInstalledPackages(): Promise<PackageCmdResult>;
  updatePackageIndex(): Promise<PackageCmdResult>;
  getSetupStatus(): Promise<SetupStatus>;
  addListener(event: string, handler: (data: ProgressEvent) => void): Promise<{ remove: () => void }>;
}

function getPlugin(): GIASetupPlugin | null {
  try {
    const isNative = typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
    const isAvailable = typeof Capacitor.isPluginAvailable === 'function' && Capacitor.isPluginAvailable('GIATerminal');
    if (isNative || isAvailable) {
      return registerPlugin('GIATerminal') as unknown as GIASetupPlugin;
    }
  } catch {
    // Web — plugin not available
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSandboxSetup() {
  const plugin = useRef<GIASetupPlugin | null>(null);
  const [isNative, setIsNative] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [phase, setPhase] = useState<SetupPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pkgInstalling, setPkgInstalling] = useState<string | null>(null);

  // Initialize plugin
  useEffect(() => {
    const p = getPlugin();
    plugin.current = p;
    setIsNative(!!p);

    if (p) {
      // Check current status
      p.getSetupStatus().then(s => {
        setSetupStatus(s);
        if (s.installed) setPhase('ready');
      }).catch(() => {
        setPhase('idle');
      });

      // Listen for progress events
      let listenerHandle: { remove: () => void } | null = null;
      p.addListener('rootfsProgress', (event: ProgressEvent) => {
        setPhase(event.phase);
        setProgress(event.progress);
        setLog(prev => {
          const next = [...prev, `[${event.phase}] ${event.message}`];
          return next.length > 100 ? next.slice(-100) : next;
        });
      }).then(h => { listenerHandle = h; });

      return () => { listenerHandle?.remove(); };
    }
  }, []);

  const clearLog = useCallback(() => setLog([]), []);

  // Start the full on-device setup
  const startSetup = useCallback(async (arch?: string) => {
    if (!plugin.current) {
      logger.warn('[useSandboxSetup] Plugin not available (web)');
      return;
    }

    setIsInstalling(true);
    setPhase('downloading');
    setProgress(0);
    setLog(['[setup] Starting on-device terminal installation...']);

    try {
      const result = await plugin.current.downloadRootfs({ arch: arch || 'aarch64' });
      setPhase('ready');
      setProgress(100);
      setLog(prev => [...prev, `[ready] ${result.message}`]);

      // Refresh status
      const status = await plugin.current.getSetupStatus();
      setSetupStatus(status);
    } catch (e) {
      setPhase('error');
      setLog(prev => [...prev, `[error] ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setIsInstalling(false);
    }
  }, []);

  // Install a single package
  const installPackage = useCallback(async (packageName: string): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    setPkgInstalling(packageName);
    try {
      const result = await plugin.current.installPackage({ packageName });
      return result;
    } finally {
      setPkgInstalling(null);
    }
  }, []);

  // Remove a package
  const removePackage = useCallback(async (packageName: string): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    return plugin.current.removePackage({ packageName });
  }, []);

  // Execute a raw shell command
  const execCommand = useCallback(async (command: string, timeout?: number): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    return plugin.current.exec({ command, timeout });
  }, []);

  // Search packages
  const searchPackages = useCallback(async (query: string): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    return plugin.current.searchPackages({ query });
  }, []);

  // List installed packages
  const listInstalledPackages = useCallback(async (): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    return plugin.current.listInstalledPackages();
  }, []);

  // Update package index
  const updatePackageIndex = useCallback(async (): Promise<PackageCmdResult | null> => {
    if (!plugin.current) return null;
    return plugin.current.updatePackageIndex();
  }, []);

  return {
    isNative,
    setupStatus,
    phase,
    progress,
    log,
    isInstalling,
    pkgInstalling,
    startSetup,
    execCommand,
    installPackage,
    removePackage,
    searchPackages,
    listInstalledPackages,
    updatePackageIndex,
    clearLog,
  };
}
