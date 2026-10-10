import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { useSandboxSetup } from '../../hooks/useSandboxSetup';

type HookState = ReturnType<typeof useSandboxSetup>;
type SetupStatus = HookState['setupStatus'];

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../hooks/useSandboxSetup', () => ({
  useSandboxSetup: () => hook.state,
}));

const NOT_INSTALLED: SetupStatus = { installed: false, rootfsPath: '', rootfsSizeBytes: 0, hasBusybox: false, hasShell: false, os: 'unknown' };

function makeState(overrides: Partial<HookState> = {}): HookState {
  return {
    isNative: true,
    phase: 'idle',
    progress: 0,
    log: [],
    isInstalling: false,
    pkgInstalling: null,
    setupStatus: { installed: true, rootfsPath: '/rootfs', rootfsSizeBytes: 0, hasBusybox: true, hasShell: true, os: 'alpine' },
    selectedOS: 'alpine',
    setSelectedOS: vi.fn(),
    startSetup: vi.fn(),
    appendLog: vi.fn(),
    execCommand: vi.fn().mockResolvedValue({ output: '', exitCode: 0 }),
    installPackage: vi.fn(),
    removePackage: vi.fn(),
    searchPackages: vi.fn(),
    listInstalledPackages: vi.fn().mockResolvedValue({ output: '', exitCode: 0 }),
    updatePackageIndex: vi.fn(),
    clearLog: vi.fn(),
    ...overrides,
  } as unknown as HookState;
}

async function renderPanel(state: HookState) {
  hook.state = state;
  const { default: SandboxSetupPanel } = await import('../SandboxSetupPanel');
  return render(<SandboxSetupPanel />);
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  cleanup();
});

describe('SandboxSetupPanel tabs', () => {
  it('renders all five tabs with System active by default', async () => {
    await renderPanel(makeState());
    for (const label of ['System', 'Shell', 'Packages', 'Files', 'MCPs']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/Installed|Install Alpine|Install Ubuntu/)).toBeTruthy();
  });

  it('opens the Files tab on click and renders the workspace folder grid', async () => {
    await renderPanel(makeState());
    fireEvent.click(screen.getByText('Files'));
    await waitFor(() => expect(screen.getByText(/Your terminal workspace/)).toBeTruthy());
    expect(screen.getByText('~/projects')).toBeTruthy();
    expect(screen.getByText('~/tools')).toBeTruthy();
  });

  it('opens Files even when the native plugin rejects (rootfs missing)', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      await renderPanel(makeState({
        listInstalledPackages: vi.fn().mockRejectedValue(new Error('rootfs missing')),
        setupStatus: NOT_INSTALLED,
      }));
      fireEvent.click(screen.getByText('Files'));
      await waitFor(() => expect(screen.getByText(/Your terminal workspace/)).toBeTruthy());
      await new Promise(r => setTimeout(r, 30));
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  it('shows setup guidance in Files when the terminal is not installed yet', async () => {
    await renderPanel(makeState({
      setupStatus: NOT_INSTALLED,
    }));
    fireEvent.click(screen.getByText('Files'));
    await waitFor(() =>
      expect(screen.getByText(/isn't set up yet/)).toBeTruthy());
  });

  it('shows real folder counts when installed', async () => {
    const execCommand = vi.fn().mockResolvedValue({
      output: 'projects:EXISTS:3\ndownloads:MISSING:0\nscripts:EXISTS:1\ndocuments:MISSING:0\ndata:MISSING:0\ntools:MISSING:0',
      exitCode: 0,
    });
    await renderPanel(makeState({ execCommand }));
    fireEvent.click(screen.getByText('Files'));
    await waitFor(() => expect(screen.getByText(/3 items/)).toBeTruthy(), { timeout: 3000 });
    expect(execCommand).toHaveBeenCalled();
  });

  it('opens the Shell tab', async () => {
    await renderPanel(makeState());
    fireEvent.click(screen.getByText('Shell'));
    await waitFor(() =>
      expect(screen.getByText(/isn't available in the browser/)).toBeTruthy());
    expect(screen.queryByText(/Your terminal workspace/)).toBeNull();
  });

  it('opens the MCPs tab with catalog entries', async () => {
    await renderPanel(makeState());
    fireEvent.click(screen.getByText('MCPs'));
    await waitFor(() => expect(screen.getByText('Filesystem')).toBeTruthy());
    expect(screen.getByText(/Model Context Protocol servers/)).toBeTruthy();
  });

  it('opens the Packages tab', async () => {
    await renderPanel(makeState());
    fireEvent.click(screen.getByText('Packages'));
    await waitFor(() => expect(screen.queryByText(/Your terminal workspace/)).toBeNull());
    expect(screen.getByPlaceholderText(/Search Alpine packages/)).toBeTruthy();
  });
});
