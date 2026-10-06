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

    expect(execMock).toHaveBeenCalledWith('echo hello', '/workspace', undefined, undefined);
    expect(result).toEqual({ stdout: 'hello\n', stderr: '', exitCode: 0 });
    vi.unstubAllGlobals();
  });

  it('clones repositories into the shared projects workspace on the native fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    execMock.mockResolvedValue({ output: 'Cloning into...', exitCode: 0, sessionId: 's1' });

    await sandboxService.clone('https://github.com/example/project.git');

    expect(execMock).toHaveBeenCalledWith(
      "mkdir -p '/workspace/projects' && GIT_ASKPASS= GIT_TERMINAL_PROMPT=0 git clone --depth 1 'https://github.com/example/project.git' '/workspace/projects/project'",
      '/workspace',
      undefined,
      undefined,
    );
    vi.unstubAllGlobals();
  });

  it('passes a GitHub token only through a temporary Git environment, never the clone command', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    execMock.mockResolvedValue({ output: 'Cloning into...', exitCode: 0, sessionId: 's1' });

    await sandboxService.clone('https://github.com/example/private.git', undefined, 'secret-token');

    const [command, workdir, env] = execMock.mock.calls[0] as [string, string, Record<string, string>];
    expect(command).not.toContain('secret-token');
    expect(workdir).toBe('/workspace');
    expect(env).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${btoa('x-access-token:secret-token')}`,
    });
    vi.unstubAllGlobals();
  });

  it('lists native project files using a shell format that preserves spaces in filenames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    execMock.mockResolvedValue({
      output: 'f\t23\tApp File.tsx\nd\t0\tsource files\n',
      exitCode: 0,
      sessionId: 's1',
    });

    const entries = await sandboxService.list('projects/demo');

    expect(entries).toEqual([
      { name: 'App File.tsx', isDir: false, size: 23, mode: 'f' },
      { name: 'source files', isDir: true, size: 0, mode: 'd' },
    ]);
    expect(execMock.mock.calls[0]?.[0]).toContain("'/workspace/projects/demo'/*");
    expect(execMock.mock.calls[0]?.slice(1)).toEqual(['/workspace']);
    vi.unstubAllGlobals();
  });

  it('rejects unsafe repository URLs and workspace path traversal', async () => {
    await expect(sandboxService.clone('https://example.com/repo.git; rm -rf /')).rejects.toThrow(/HTTPS or SSH/i);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    isAvailableMock.mockReturnValue(true);
    await sandboxService.ensureAvailable();
    await expect(sandboxService.list('../outside')).rejects.toThrow(/parent directories/i);
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

    expect(execMock).toHaveBeenCalledWith('apk add --no-cache python3 git', '/workspace', undefined, undefined);
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
