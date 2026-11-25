import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execMock = vi.fn();
const isAvailableMock = vi.fn();

vi.mock('../TerminalService', () => ({
  default: {
    isAvailable: () => isAvailableMock(),
    exec: (...args: unknown[]) => execMock(...args),
  },
}));

const { default: sandboxService, SANDBOX_BUDGETS } = await import('../SandboxService');

/** Remote mode: /health answers OK, everything else routed by the test. */
function stubRemote(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/health')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return handler(url, init);
  }));
}

function timeoutError(): DOMException {
  return new DOMException('The signal has timed out.', 'TimeoutError');
}

describe('SandboxService — per-operation timing and resilience', () => {
  beforeEach(async () => {
    execMock.mockReset();
    isAvailableMock.mockReset();
    sandboxService.setBaseUrl('http://localhost:3081');
    // Reset the service's private availability state between tests: run one
    // doomed health check so _available=false and usingNativeFallback=false,
    // no matter what the previous test (remote or native) left behind.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await sandboxService.checkHealth();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('translates request timeouts into a message that names the real budget', async () => {
    stubRemote(async () => { throw timeoutError(); });
    expect(await sandboxService.checkHealth()).toBe(true);
    // readFile uses the fs budget (120s).
    await expect(sandboxService.readFile('notes/app.txt')).rejects.toThrow('timed out after 120s');
    // list uses the list budget (30s).
    await expect(sandboxService.list('projects')).rejects.toThrow('timed out after 30s');
  });

  it('gives exec the exec budget (5min) and long-running ops 10 minutes', async () => {
    stubRemote(async () => { throw timeoutError(); });
    expect(await sandboxService.checkHealth()).toBe(true);
    await expect(sandboxService.exec('npm run build')).rejects.toThrow('timed out after 300s');
    // A caller-provided command timeout extends the HTTP budget past 5 minutes.
    await expect(sandboxService.exec('npm install', { timeout: SANDBOX_BUDGETS.long }))
      .rejects.toThrow('timed out after 605s');
  });

  it('chunks large writes in the native fallback: first part truncates, the rest append', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    execMock.mockResolvedValue({ output: '', exitCode: 0, sessionId: 's1' });

    // ~2.6MB of base64 → three ~1MB shell commands instead of one giant argv.
    const content = 'x'.repeat(2_000_000);
    await sandboxService.writeFile('big/blob.bin', content);

    const commands = execMock.mock.calls.map((call) => String(call[0]));
    expect(commands.length).toBeGreaterThanOrEqual(3);
    const writeCommands = commands.filter((cmd) => cmd.includes('base64 -d'));
    expect(writeCommands.length).toBeGreaterThanOrEqual(3);
    // Parent dir mkdir happens once, before the first write.
    expect(commands[0]).toContain("mkdir -p -- '/workspace/big'");

    // First write truncates ('>'), every following part appends ('>>').
    expect(writeCommands[0]).toContain("base64 -d > '/workspace/big/blob.bin'");
    for (const cmd of writeCommands.slice(1)) {
      expect(cmd).toContain("base64 -d >> '/workspace/big/blob.bin'");
    }

    // Reconstructing the parts in order yields exactly the original content.
    const parts = writeCommands.map((cmd) => /echo '([^']*)' \| base64 -d/.exec(cmd)?.[1] ?? '');
    const decoded = Buffer.concat(parts.map((part) => Buffer.from(part, 'base64'))).toString('utf8');
    expect(decoded).toBe(content);
    // No single command carries an argv anywhere near the 2MB payload.
    for (const cmd of writeCommands) {
      expect(cmd.length).toBeLessThan(1_100_000);
    }
  });

  it('writes small files with a single truncating command', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    execMock.mockResolvedValue({ output: '', exitCode: 0, sessionId: 's1' });

    await sandboxService.writeFile('notes/app.txt', 'hello world');

    const writeCommands = execMock.mock.calls.map((call) => String(call[0])).filter((cmd) => cmd.includes('base64 -d'));
    expect(writeCommands).toHaveLength(1);
    expect(writeCommands[0]).toContain("base64 -d > '/workspace/notes/app.txt'");
    const part = /echo '([^']*)' \| base64 -d/.exec(writeCommands[0])?.[1] ?? '';
    expect(Buffer.from(part, 'base64').toString('utf8')).toBe('hello world');
  });

  it('captures mtimeMs via the 4-column stat probe and falls back to 3 columns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    // Probe succeeds → 4-column output with epoch seconds.
    execMock.mockImplementation(async (command: string) => {
      if (command.startsWith('stat -c %Y')) return { output: '', exitCode: 0, sessionId: 's1' };
      return {
        output: 'd\t0\tsubdir\t1735689600\nf\t12\tfile.txt\t1735689601',
        exitCode: 0,
        sessionId: 's1',
      };
    });
    const withMtime = await sandboxService.list('projects/demo');
    expect(withMtime).toEqual([
      { name: 'subdir', isDir: true, size: 0, mode: 'd', mtimeMs: 1735689600000 },
      { name: 'file.txt', isDir: false, size: 12, mode: 'f', mtimeMs: 1735689601000 },
    ]);

    // Probe fails (busybox stat without -c) → graceful 3-column fallback.
    execMock.mockImplementation(async (command: string) => {
      if (command.startsWith('stat -c %Y')) return { output: 'stat: unrecognized option', exitCode: 1, sessionId: 's1' };
      return { output: 'd\t0\tsubdir\nf\t7\tnote.txt', exitCode: 0, sessionId: 's1' };
    });
    const withoutMtime = await sandboxService.list('projects/demo');
    expect(withoutMtime).toEqual([
      { name: 'subdir', isDir: true, size: 0, mode: 'd' },
      { name: 'note.txt', isDir: false, size: 7, mode: 'f' },
    ]);
    expect('mtimeMs' in withoutMtime[0]).toBe(false);
  });

  it('recovers once from a lost native session and retries the command', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    expect(sandboxService.isUsingNativeFallback()).toBe(true);

    // First exec throws a session-lost error; recovery re-verifies (health
    // check still down, terminal still up) and the retry succeeds.
    execMock.mockImplementationOnce(async () => { throw new Error('no active session'); });
    execMock.mockResolvedValue({ output: 'recovered\n', exitCode: 0, sessionId: 's1' });

    const result = await sandboxService.exec('echo hello');
    expect(result).toEqual({ stdout: 'recovered\n', stderr: '', exitCode: 0 });
    expect(execMock).toHaveBeenCalledTimes(2);
  });

  it('recovers from a session death surfaced as a non-zero exit with the plugin message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    execMock.mockImplementationOnce(async () => ({
      output: '[TerminalService] GIATerminal plugin not available on this platform',
      exitCode: -1,
      sessionId: 'mock',
    }));
    execMock.mockResolvedValue({ output: 'ok', exitCode: 0, sessionId: 's1' });

    const result = await sandboxService.exec('echo hello');
    expect(result.stdout).toBe('ok');
    expect(execMock).toHaveBeenCalledTimes(2);
  });

  it('fails with a clear message when recovery cannot re-establish any transport', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    isAvailableMock.mockReturnValue(false);
    execMock.mockImplementationOnce(async () => { throw new Error('no active session'); });

    await expect(sandboxService.exec('echo hello')).rejects.toThrow(/session appears to have been lost/);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('does not trigger recovery for ordinary command failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    execMock.mockResolvedValueOnce({ output: "cat: can't open '/workspace/missing.txt'", exitCode: 1, sessionId: 's1' });

    const result = await sandboxService.exec('cat missing.txt');
    expect(result.exitCode).toBe(1);
    // One attempt only — no retry, no recovery round-trip.
    expect(execMock).toHaveBeenCalledTimes(1);
  });
});
