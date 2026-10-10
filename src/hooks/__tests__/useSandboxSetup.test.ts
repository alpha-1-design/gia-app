import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { SetupStatus, ProgressEvent, PackageCmdResult } from '../../hooks/useSandboxSetup';

const registerPluginMock = vi.fn();
const isNativePlatformMock = vi.fn(() => false);
const isPluginAvailableMock = vi.fn(() => false);

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: (...args: unknown[]) => isNativePlatformMock(...(args as [])),
    isPluginAvailable: (...args: unknown[]) => isPluginAvailableMock(...(args as [])),
  },
  registerPlugin: (...args: unknown[]) => registerPluginMock(...(args as [])),
}));

const { useSandboxSetup } = await import('../useSandboxSetup');

type Handler = (e: ProgressEvent) => void;

interface FakePlugin {
  downloadRootfs: ReturnType<typeof vi.fn>;
  execCommand: ReturnType<typeof vi.fn>;
  installPackage: ReturnType<typeof vi.fn>;
  removePackage: ReturnType<typeof vi.fn>;
  searchPackages: ReturnType<typeof vi.fn>;
  listInstalledPackages: ReturnType<typeof vi.fn>;
  updatePackageIndex: ReturnType<typeof vi.fn>;
  getSetupStatus: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
}

function status(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return { installed: false, rootfsPath: '/data/rootfs', rootfsSizeBytes: 1024, hasBusybox: false, hasShell: false, ...overrides };
}

function setupNative(initialStatus: SetupStatus = status()) {
  const handlers = new Map<string, Handler>();
  const removes: Array<ReturnType<typeof vi.fn>> = [];

  const plugin: FakePlugin = {
    downloadRootfs: vi.fn(async () => ({ success: true, message: 'rootfs extracted' })),
    execCommand: vi.fn(async () => ({ output: 'done', exitCode: 0 })),
    installPackage: vi.fn(async ({ packageName }: { packageName: string }) => ({ output: `installed ${packageName}`, exitCode: 0 })),
    removePackage: vi.fn(async () => ({ output: 'removed', exitCode: 0 })),
    searchPackages: vi.fn(async () => ({ output: 'pkg1.0', exitCode: 0 })),
    listInstalledPackages: vi.fn(async () => ({ output: 'busybox', exitCode: 0 })),
    updatePackageIndex: vi.fn(async () => ({ output: 'index updated', exitCode: 0 })),
    getSetupStatus: vi.fn(async () => initialStatus),
    addListener: vi.fn(async (event: string, handler: Handler) => {
      handlers.set(event, handler);
      const removeMock = vi.fn(() => handlers.delete(event));
      removes.push(removeMock);
      return { remove: removeMock };
    }),
  };

  isNativePlatformMock.mockReturnValue(true);
  isPluginAvailableMock.mockReturnValue(true);
  registerPluginMock.mockReturnValue(plugin);
  return { plugin, handlers, removes };
}

function setupWeb() {
  isNativePlatformMock.mockReturnValue(false);
  isPluginAvailableMock.mockReturnValue(false);
  registerPluginMock.mockReturnValue(null);
}

describe('useSandboxSetup — web (no native plugin)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports isNative=false and never registers the plugin', async () => {
    setupWeb();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(false));
    expect(registerPluginMock).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(result.current.setupStatus).toBeNull();
  });

  it('every plugin-backed action returns null instead of throwing', async () => {
    setupWeb();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(false));

    await act(async () => {
      expect(await result.current.execCommand('ls')).toBeNull();
      expect(await result.current.installPackage('gcc')).toBeNull();
      expect(await result.current.removePackage('gcc')).toBeNull();
      expect(await result.current.searchPackages('gcc')).toBeNull();
      expect(await result.current.listInstalledPackages()).toBeNull();
      expect(await result.current.updatePackageIndex()).toBeNull();
    });
  });

  it('startSetup is a no-op on web: phase stays idle, nothing marked installing', async () => {
    setupWeb();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(false));

    await act(async () => { await result.current.startSetup(); });
    expect(result.current.phase).toBe('idle');
    expect(result.current.isInstalling).toBe(false);
    expect(result.current.log).toEqual([]);
  });
});

describe('useSandboxSetup — native', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads setup status on mount and flips to ready when already installed', async () => {
    const { plugin } = setupNative(status({ installed: true, hasBusybox: true, hasShell: true }));
    const { result } = renderHook(() => useSandboxSetup());

    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current.isNative).toBe(true);
    expect(plugin.getSetupStatus).toHaveBeenCalledTimes(1);
    expect(result.current.setupStatus?.installed).toBe(true);
    expect(result.current.setupStatus?.hasShell).toBe(true);
  });

  it('stays idle when the rootfs is not installed yet', async () => {
    setupNative(status({ installed: false }));
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));
    expect(result.current.phase).toBe('idle');
  });

  it('stays idle (not error) when getSetupStatus rejects', async () => {
    const { plugin } = setupNative();
    plugin.getSetupStatus.mockRejectedValueOnce(new Error('plugin bridge dead'));
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(plugin.getSetupStatus).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(result.current.phase).toBe('idle');
  });

  it('applies rootfsProgress events to phase, progress and log', async () => {
    const { handlers } = setupNative();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(handlers.has('rootfsProgress')).toBe(true));

    act(() => {
      handlers.get('rootfsProgress')!({ phase: 'extracting', progress: 40, message: 'extracting 40%', timestamp: 1 });
    });
    expect(result.current.phase).toBe('extracting');
    expect(result.current.progress).toBe(40);
    expect(result.current.log).toEqual(['[extracting] extracting 40%']);
  });

  it('caps the live log at 100 lines, keeping the newest', async () => {
    const { handlers } = setupNative();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(handlers.has('rootfsProgress')).toBe(true));

    act(() => {
      for (let i = 0; i < 105; i++) {
        handlers.get('rootfsProgress')!({ phase: 'installing', progress: i, message: `line ${i}`, timestamp: i });
      }
    });
    expect(result.current.log).toHaveLength(100);
    expect(result.current.log[0]).toBe('[installing] line 5');
    expect(result.current.log.at(-1)).toBe('[installing] line 104');
  });

  it('startSetup defaults to aarch64/alpine, walks to ready, and refreshes status', async () => {
    const { plugin } = setupNative(status({ installed: true }));
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    // Reset to the not-installed state so the run itself is observable.
    act(() => { result.current.clearLog(); });

    await act(async () => { await result.current.startSetup(); });

    expect(plugin.downloadRootfs).toHaveBeenCalledWith({ arch: 'aarch64', os: 'alpine' });
    expect(result.current.phase).toBe('ready');
    expect(result.current.progress).toBe(100);
    expect(result.current.isInstalling).toBe(false);
    expect(result.current.log[0]).toContain('Starting on-device Alpine Linux installation');
    expect(result.current.log.at(-1)).toContain('rootfs extracted');
    // mount status check + post-install refresh
    expect(plugin.getSetupStatus).toHaveBeenCalledTimes(2);
  });

  it('startSetup forwards an explicit arch/os and labels Ubuntu in the log', async () => {
    const { plugin } = setupNative();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));

    await act(async () => { await result.current.startSetup('x86_64', 'ubuntu'); });

    expect(plugin.downloadRootfs).toHaveBeenCalledWith({ arch: 'x86_64', os: 'ubuntu' });
    expect(result.current.log[0]).toContain('Ubuntu 24.04');
  });

  it('startSetup failure sets error phase, logs the message, and clears isInstalling', async () => {
    const { plugin } = setupNative();
    plugin.downloadRootfs.mockRejectedValueOnce(new Error('network unreachable'));
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));

    await act(async () => { await result.current.startSetup(); });

    expect(result.current.phase).toBe('error');
    expect(result.current.isInstalling).toBe(false);
    expect(result.current.log.at(-1)).toBe('[error] network unreachable');
  });

  it('installPackage sets pkgInstalling during the call and clears it after', async () => {
    const { plugin } = setupNative();
    let resolveInstall: ((r: PackageCmdResult) => void) | null = null;
    plugin.installPackage.mockImplementation(() => new Promise(res => { resolveInstall = res; }));

    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));

    let pending: Promise<PackageCmdResult | null> | null = null;
    act(() => { pending = result.current.installPackage('gcc'); });
    expect(result.current.pkgInstalling).toBe('gcc');

    let res: PackageCmdResult | null = null;
    await act(async () => {
      resolveInstall!({ output: 'added gcc', exitCode: 0 });
      res = await pending!;
    });
    expect(res).toEqual({ output: 'added gcc', exitCode: 0 });
    expect(result.current.pkgInstalling).toBeNull();
    expect(plugin.installPackage).toHaveBeenCalledWith({ packageName: 'gcc' });
  });

  it('execCommand forwards the timeout to the plugin', async () => {
    const { plugin } = setupNative();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));

    await act(async () => { await result.current.execCommand('tail -f /var/log/x', 5000); });
    expect(plugin.execCommand).toHaveBeenCalledWith({ command: 'tail -f /var/log/x', timeout: 5000 });
  });

  it('appendLog caps at 100 lines and clearLog empties it', async () => {
    setupNative();
    const { result } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(result.current.isNative).toBe(true));

    act(() => { for (let i = 0; i < 105; i++) result.current.appendLog(`line ${i}`); });
    expect(result.current.log).toHaveLength(100);
    expect(result.current.log[0]).toBe('line 5');

    act(() => { result.current.clearLog(); });
    expect(result.current.log).toEqual([]);
  });

  it('removes the progress listener on unmount', async () => {
    const { removes } = setupNative();
    const { unmount } = renderHook(() => useSandboxSetup());
    await waitFor(() => expect(removes.length).toBe(1));

    unmount();
    expect(removes[0]).toHaveBeenCalledTimes(1);
  });
});
