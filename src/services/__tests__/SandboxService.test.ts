import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();
const isAvailableMock = vi.fn();

vi.mock('../TerminalService', () => ({
  default: {
    isAvailable: () => isAvailableMock(),
    exec: (...args: unknown[]) => execMock(...args),
  },
}));

const { default: sandboxService } = await import('../SandboxService');

describe('SandboxService — native terminal fallback', () => {
  beforeEach(() => {
    execMock.mockReset();
    isAvailableMock.mockReset();
    // Reset private state between tests via the public surface.
    sandboxService.setBaseUrl('http://localhost:3081');
  });

  it('falls back to the native terminal when the remote server is unreachable but the terminal is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);

    const available = await sandboxService.ensureAvailable();
    expect(available).toBe(true);
    expect(sandboxService.isUsingNativeFallback()).toBe(true);
    vi.unstubAllGlobals();
  });

  it('reports unavailable when neither the remote server nor the native terminal can be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(false);

    const available = await sandboxService.ensureAvailable();
    expect(available).toBe(false);
    vi.unstubAllGlobals();
  });

  it('exec() routes through the native terminal in fallback mode and adapts the result shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    execMock.mockResolvedValue({ output: 'hello\n', exitCode: 0, sessionId: 's1' });
    const result = await sandboxService.exec('echo hello');

    expect(execMock).toHaveBeenCalledWith('echo hello', undefined, undefined, undefined);
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
    vi.unstubAllGlobals();
  });

  it('downloadUrl() returns null in fallback mode instead of a dead link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    expect(sandboxService.downloadUrl('report.pdf')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('install() maps to apk add on the native terminal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();

    execMock.mockResolvedValue({ output: '', exitCode: 0, sessionId: 's1' });
    await sandboxService.install(['python3', 'git']);

    expect(execMock).toHaveBeenCalledWith('apk add --no-cache python3 git', undefined, undefined, undefined);
    vi.unstubAllGlobals();
  });

  it('prefers the remote server when it is actually reachable, even if the native terminal also is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ stdout: 'remote', stderr: '', exitCode: 0 }) });
    }));
    isAvailableMock.mockReturnValue(true);

    const available = await sandboxService.ensureAvailable();
    expect(available).toBe(true);
    expect(sandboxService.isUsingNativeFallback()).toBe(false);
    vi.unstubAllGlobals();
  });
});
