import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnMock = vi.fn();
const readOutputMock = vi.fn();
const killMock = vi.fn();
const isAvailableMock = vi.fn();

vi.mock('../TerminalService', () => ({
  default: {
    isAvailable: () => isAvailableMock(),
    spawn: (...a: unknown[]) => spawnMock(...a),
    readOutput: (...a: unknown[]) => readOutputMock(...a),
    kill: (...a: unknown[]) => killMock(...a),
  },
}));

vi.mock('../SandboxService', () => ({
  default: {
    ensureAvailable: vi.fn(async () => true),
    exec: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  },
}));

const { terminalTools } = await import('../tools/terminal');
const bgTool = terminalTools.find((t) => t.id === 'terminal_background');

describe('terminal_background', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    readOutputMock.mockReset();
    killMock.mockReset();
    isAvailableMock.mockReset();
    isAvailableMock.mockReturnValue(true);
  });

  it('is registered alongside the other terminal tools', () => {
    expect(bgTool).toBeDefined();
    expect(terminalTools.map((t) => t.id)).toEqual(
      expect.arrayContaining(['terminal_run', 'terminal_status', 'terminal_kill', 'terminal_background']),
    );
  });

  it('start launches the command on the native terminal and returns a session id', async () => {
    spawnMock.mockResolvedValue({ sessionId: 'sess-1', command: 'npm run dev', running: true });

    const res = await bgTool!.execute({ action: 'start', command: 'npm run dev' });

    expect(res.success).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('npm run dev');
    expect(res.content).toContain('sess-1');
  });

  it('start without a command fails without calling the native layer', async () => {
    const res = await bgTool!.execute({ action: 'start' });

    expect(res.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('log returns the buffered output for a running session', async () => {
    readOutputMock.mockResolvedValue({ output: 'VITE ready in 300ms', running: true, gone: false, exitCode: -1 });

    const res = await bgTool!.execute({ action: 'log', sessionId: 'sess-1' });

    expect(res.success).toBe(true);
    expect(res.content).toContain('VITE ready in 300ms');
    expect(res.content).toContain('running');
    expect(readOutputMock).toHaveBeenCalledWith('sess-1');
  });

  it('log reports a finished process and its exit code', async () => {
    readOutputMock.mockResolvedValue({ output: 'bye', running: false, gone: true, exitCode: 0 });

    const res = await bgTool!.execute({ action: 'log', sessionId: 'sess-1' });

    expect(res.success).toBe(true);
    expect(res.content).toContain('finished');
    expect(res.content).toContain('exit 0');
  });

  it('log without a session id fails', async () => {
    const res = await bgTool!.execute({ action: 'log' });

    expect(res.success).toBe(false);
    expect(readOutputMock).not.toHaveBeenCalled();
  });

  it('stop kills the session', async () => {
    killMock.mockResolvedValue(undefined);

    const res = await bgTool!.execute({ action: 'stop', sessionId: 'sess-1' });

    expect(res.success).toBe(true);
    expect(killMock).toHaveBeenCalledWith('sess-1');
  });

  it('rejects an unknown action', async () => {
    const res = await bgTool!.execute({ action: 'explode' });

    expect(res.success).toBe(false);
    expect(res.content).toBe('');
  });
});
