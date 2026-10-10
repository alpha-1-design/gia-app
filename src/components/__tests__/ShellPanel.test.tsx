import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import ShellPanel from '../ShellPanel';

const isAvailableMock = vi.fn(() => true);
const spawnMock = vi.fn();
const readOutputMock = vi.fn();
const killMock = vi.fn(async () => undefined);

vi.mock('../../services/TerminalService', () => ({
  default: {
    isAvailable: (...args: unknown[]) => isAvailableMock(...(args as [])),
    spawn: (...args: unknown[]) => spawnMock(...(args as [])),
    readOutput: (...args: unknown[]) => readOutputMock(...(args as [])),
    kill: (...args: unknown[]) => killMock(...(args as [])),
  },
}));

function typeCommand(cmd: string) {
  const input = screen.getByLabelText('Shell command');
  fireEvent.change(input, { target: { value: cmd } });
  fireEvent.keyUp(input, { key: 'Enter' });
}

describe('ShellPanel', () => {
  beforeAll(() => {
    // jsdom doesn't implement scrollIntoView (used to follow new output).
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    isAvailableMock.mockReturnValue(true);
    spawnMock.mockResolvedValue({ sessionId: 's1', command: 'x', running: true });
    readOutputMock.mockResolvedValue({ output: '', running: false, gone: false, exitCode: 0 });
  });

  afterEach(() => cleanup());

  it('renders the web fallback message instead of a shell when the plugin is unavailable', () => {
    isAvailableMock.mockReturnValue(false);
    render(<ShellPanel />);
    expect(screen.getByText(/isn't available in the browser/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Shell command')).not.toBeInTheDocument();
  });

  it('shows the empty-state hint, /workspace prompt, and a disabled run button', () => {
    render(<ShellPanel />);
    expect(screen.getByText(/Alpine Linux shell/i)).toBeInTheDocument();
    expect(screen.getByText('root@gia:/workspace#')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run command' })).toBeDisabled();
  });

  it('runs a command: spawns with wrapped input, streams output, and re-enables input', async () => {
    readOutputMock.mockResolvedValue({ output: 'file1\nfile2\n', running: false, gone: false, exitCode: 0 });
    render(<ShellPanel />);
    typeCommand('ls');

    // Spawn receives the real wrapCommand() wrapper and the current cwd.
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const [wrapped, workdir] = spawnMock.mock.calls[0];
    expect(String(wrapped)).toContain('ls\n');
    expect(String(wrapped)).toContain('exit $__gia_rc');
    expect(workdir).toBe('/workspace');

    // While running: entry shows a spinner-ish state and input is disabled.
    expect(screen.getByText('running…')).toBeInTheDocument();
    expect(screen.getByLabelText('Shell command')).toBeDisabled();

    // After the command finishes: output rendered, exit 0 not shown as failure.
    expect(await screen.findByText('file1 file2')).toBeInTheDocument();
    expect(screen.queryByText(/^exit /)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Shell command')).toBeEnabled();
    expect(screen.getByLabelText('Shell command')).toHaveValue('');
  });

  it('renders a red exit line for non-zero exit codes', async () => {
    readOutputMock.mockResolvedValue({ output: 'sh: nope: not found', running: false, gone: false, exitCode: 127 });
    render(<ShellPanel />);
    typeCommand('nope');
    expect(await screen.findByText('exit 127')).toBeInTheDocument();
  });

  it("handles 'clear' locally without spawning a session", async () => {
    readOutputMock.mockResolvedValue({ output: 'x', running: false, gone: false, exitCode: 0 });
    render(<ShellPanel />);
    typeCommand('ls');
    await screen.findByText('x');
    expect(screen.getByText('x')).toBeInTheDocument();

    typeCommand('clear');
    await vi.waitFor(() => expect(screen.queryByText('x')).not.toBeInTheDocument());
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces spawn failures on the entry with exit -1', async () => {
    spawnMock.mockRejectedValue(new Error('Terminal rootfs is missing'));
    render(<ShellPanel />);
    typeCommand('ls');
    expect(await screen.findByText('Terminal rootfs is missing')).toBeInTheDocument();
    expect(await screen.findByText('exit -1')).toBeInTheDocument();
    expect(screen.getByLabelText('Shell command')).toBeEnabled();
  });

  it('adopts the cwd reported by the shell and uses it for the next command', async () => {
    readOutputMock.mockResolvedValue({
      output: 'moved\n__GIA_CWD__/workspace/proj\n',
      running: false,
      gone: false,
      exitCode: 0,
    });
    render(<ShellPanel />);
    typeCommand('cd /workspace/proj');

    // The prompt tracks the new directory.
    expect(await screen.findByText('root@gia:/workspace/proj#')).toBeInTheDocument();

    readOutputMock.mockResolvedValue({ output: '', running: false, gone: false, exitCode: 0 });
    typeCommand('ls');
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2));
    expect(spawnMock.mock.calls[1][1]).toBe('/workspace/proj');
  });

  it('recalls command history with ArrowUp/ArrowDown', async () => {
    render(<ShellPanel />);
    typeCommand('ls -la');
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const input = screen.getByLabelText('Shell command') as HTMLInputElement;

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('ls -la');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('');
  });

  it('stop button kills the running session and reports exit 130', async () => {
    let killed = false;
    killMock.mockImplementation(async () => { killed = true; });
    readOutputMock.mockImplementation(async () =>
      killed
        ? { output: '', running: false, gone: false, exitCode: 0 }
        : { output: '', running: true, gone: false, exitCode: 0 },
    );

    render(<ShellPanel />);
    typeCommand('sleep 999');
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'Stop command' }));
    await vi.waitFor(() => expect(killMock).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('exit 130')).toBeInTheDocument();
  });

  it('kills the session if the panel unmounts while a command runs', async () => {
    readOutputMock.mockImplementation(async () => ({ output: '', running: true, gone: false, exitCode: 0 }));
    const { unmount } = render(<ShellPanel />);
    typeCommand('sleep 999');
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    await act(async () => {});

    unmount();
    expect(killMock).toHaveBeenCalledWith('s1');
  });
});
