import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execMock = vi.fn();
const isAvailableMock = vi.fn();
const reinstallRootfsMock = vi.fn();

vi.mock('../TerminalService', () => ({
  default: {
    isAvailable: (...args: unknown[]) => isAvailableMock(...args),
    exec: (...args: unknown[]) => execMock(...args),
    reinstallRootfs: (...args: unknown[]) => reinstallRootfsMock(...args),
  },
}));

const setSandboxEnvReadyMock = vi.fn();
vi.mock('../../store/useGiaStore', () => ({
  useGiaStore: {
    getState: () => ({ setSandboxEnvReady: setSandboxEnvReadyMock }),
  },
}));

// Import AFTER mocks
const { SandboxEnvService } = await import('../SandboxEnvService');

function makeExecResult(output: string, exitCode = 0) {
  return { output, exitCode, sessionId: 'test-session' };
}

const PROOT_ERRORS = [
  'fatal error: see `libproot.so --help`.',
  'proot error: \'/usr/bin/env\' not found',
  "proot warning: can't chdir(\"/root/.\")",
  'libproot.so: Cannot execute binary',
  'fatal error: /usr/bin/env not found',
  'No such file or directory: /bin/sh',
];

describe('SandboxEnvService', () => {
  beforeEach(() => {
    vi.resetModules();
    execMock.mockReset();
    isAvailableMock.mockReset();
    reinstallRootfsMock.mockReset();
    setSandboxEnvReadyMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // isAvailable
  // =========================================================================
  describe('isAvailable', () => {
    it('returns true when plugin is registered', () => {
      isAvailableMock.mockReturnValue(true);
      expect(SandboxEnvService.isAvailable()).toBe(true);
    });

    it('returns false when plugin is not registered', () => {
      isAvailableMock.mockReturnValue(false);
      expect(SandboxEnvService.isAvailable()).toBe(false);
    });
  });

  // =========================================================================
  // isExecutable
  // =========================================================================
  describe('isExecutable', () => {
    it('returns false when plugin is not available', async () => {
      isAvailableMock.mockReturnValue(false);
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });

    it('returns false when exec returns mock session', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue({ output: '', exitCode: -1, sessionId: 'mock' });
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });

    it('returns false when proot outputs fatal error', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult('fatal error: see `libproot.so --help`.'));
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });

    it('returns false when /usr/bin/env not found', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult("proot error: '/usr/bin/env' not found"));
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });

    it('returns true when echo ok succeeds cleanly', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult('ok'));
      expect(await SandboxEnvService.isExecutable()).toBe(true);
    });

    it('returns false when exec throws', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockRejectedValue(new Error('Plugin crashed'));
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });
  });

  // =========================================================================
  // status
  // =========================================================================
  describe('status', () => {
    it('returns unavailable when plugin not registered', async () => {
      isAvailableMock.mockReturnValue(false);
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(false);
      expect(s.ready).toBe(false);
      expect(s.packages).toHaveLength(0);
      expect(setSandboxEnvReadyMock).toHaveBeenCalledWith(false);
    });

    it('returns unavailable when proot probe fails with fatal error', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult('fatal error: see `libproot.so --help`.'));
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(false);
    });

    it('returns unavailable when proot probe throws', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockRejectedValue(new Error('timeout'));
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(false);
    });

    it('returns unavailable when exec returns mock session', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue({ output: '', exitCode: -1, sessionId: 'mock' });
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(false);
    });

    it('returns available with packages when everything works', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4'));
        if (cmd.includes('git --version')) return Promise.resolve(makeExecResult('git version 2.43.0'));
        if (cmd.includes('python3 --version')) return Promise.resolve(makeExecResult('Python 3.11.6'));
        if (cmd.includes('gcc --version')) return Promise.resolve(makeExecResult('gcc (Alpine 13.2.1)'));
        return Promise.resolve(makeExecResult(''));
      });
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(true);
      expect(s.ready).toBe(true); // node + npm both ok
      expect(s.resolv).toBe(true);
      expect(s.packages).toHaveLength(5);
      expect(s.packages.find(p => p.key === 'node')?.ok).toBe(true);
      expect(s.packages.find(p => p.key === 'npm')?.ok).toBe(true);
      expect(setSandboxEnvReadyMock).toHaveBeenCalledWith(true);
    });

    it('marks packages as not-ok when their output contains proot errors', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('fatal error: libproot.so'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('npm command not found'));
        return Promise.resolve(makeExecResult(''));
      });
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(true);
      expect(s.ready).toBe(false); // node + npm both not ok
      const nodePkg = s.packages.find(p => p.key === 'node');
      expect(nodePkg?.ok).toBe(false);
      expect(nodePkg?.version).toBeNull();
    });

    it('detects resolv.conf presence', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('NO'));
        return Promise.resolve(makeExecResult('not found'));
      });
      const s = await SandboxEnvService.status();
      expect(s.resolv).toBe(false);
    });

    it('handles empty exec output', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult(''));
      const s = await SandboxEnvService.status();
      expect(s.available).toBe(true);
    });

    it('handles exec output with newlines', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('YES\n'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0\n'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4\n'));
        return Promise.resolve(makeExecResult(''));
      });
      const s = await SandboxEnvService.status();
      expect(s.ready).toBe(true);
    });
  });

  // =========================================================================
  // provision (package-only, requires working terminal)
  // =========================================================================
  describe('provision', () => {
    it('returns error when terminal not executable', async () => {
      isAvailableMock.mockReturnValue(false);
      const r = await SandboxEnvService.provision();
      expect(r.success).toBe(false);
      expect(r.output).toContain('not available');
    });

    it('installs packages when terminal works', async () => {
      isAvailableMock.mockReturnValue(true);
      // Track installs so the final status() check sees them as installed
      let apkAddCount = 0;
      execMock.mockImplementation((cmd: string) => {
        if (cmd === 'echo ok') return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('apk update')) return Promise.resolve(makeExecResult('OK'));
        if (cmd.includes('apk add')) {
          apkAddCount++;
          return Promise.resolve(makeExecResult(''));
        }
        // After at least one apk add, packages are 'installed'
        if (apkAddCount > 0) {
          if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0'));
          if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4'));
          if (cmd.includes('git --version')) return Promise.resolve(makeExecResult('git version 2.43.0'));
          if (cmd.includes('python3 --version')) return Promise.resolve(makeExecResult('Python 3.11.6'));
          if (cmd.includes('pip3 --version')) return Promise.resolve(makeExecResult('24.0'));
          if (cmd.includes('gcc --version')) return Promise.resolve(makeExecResult('gcc 13.2'));
          if (cmd.includes('curl --version')) return Promise.resolve(makeExecResult('curl 8.5.0'));
        }
        // Not installed yet — exitCode 1 so provision detects it needs installing
        return { output: 'not found', exitCode: 1, sessionId: 'test-session' };
      });
      const r = await SandboxEnvService.provision();
      expect(r.success).toBe(true);
      expect(r.output).toContain('DNS configured');
      expect(r.output).toContain('Package index updated');
    });

    it('skips already-installed packages', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd === 'echo ok') return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4'));
        if (cmd.includes('git --version')) return Promise.resolve(makeExecResult('git version 2.43.0'));
        if (cmd.includes('python3 --version')) return Promise.resolve(makeExecResult('Python 3.11.6'));
        if (cmd.includes('pip3 --version')) return Promise.resolve(makeExecResult('24.0'));
        if (cmd.includes('gcc --version')) return Promise.resolve(makeExecResult('gcc 13.2'));
        if (cmd.includes('curl --version')) return Promise.resolve(makeExecResult('curl 8.5.0'));
        if (cmd.includes('apk update')) return Promise.resolve(makeExecResult('OK'));
        return Promise.resolve(makeExecResult(''));
      });
      const r = await SandboxEnvService.provision();
      expect(r.output).toContain('already installed');
      // Should not call apk add for already-installed packages
      const apkAddCalls = execMock.mock.calls.filter((c: string[]) => c[0]?.includes('apk add'));
      expect(apkAddCalls).toHaveLength(0);
    });

    it('calls onProgress with step numbers', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        return Promise.resolve(makeExecResult('not found'));
      });
      const progressCalls: { msg: string; step?: number; total?: number }[] = [];
      await SandboxEnvService.provision((msg, step, total) => {
        progressCalls.push({ msg, step, total });
      });
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].step).toBe(1);
      expect(progressCalls[0].total).toBe(9);
    });

    it('handles provision error mid-step', async () => {
      isAvailableMock.mockReturnValue(true);
      let callCount = 0;
      execMock.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return Promise.resolve(makeExecResult('YES'));
        return Promise.reject(new Error('Process killed'));
      });
      const r = await SandboxEnvService.provision();
      expect(r.success).toBe(false);
      expect(r.output).toContain('Process killed');
    });
  });

  // =========================================================================
  // installEnvironment (rootfs + packages)
  // =========================================================================
  describe('installEnvironment', () => {
    it('calls reinstallRootfs first', async () => {
      isAvailableMock.mockReturnValue(true);
      reinstallRootfsMock.mockResolvedValue({ success: true, message: 'Re-extracted' });
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4'));
        if (cmd.includes('git --version')) return Promise.resolve(makeExecResult('git version 2.43.0'));
        if (cmd.includes('python3 --version')) return Promise.resolve(makeExecResult('Python 3.11.6'));
        if (cmd.includes('gcc --version')) return Promise.resolve(makeExecResult('gcc 13.2'));
        if (cmd.includes('apk update')) return Promise.resolve(makeExecResult('OK'));
        return Promise.resolve(makeExecResult(''));
      });
      vi.useFakeTimers();
      const promise = SandboxEnvService.installEnvironment();
      await vi.advanceTimersByTimeAsync(2000);
      const r = await promise;
      expect(reinstallRootfsMock).toHaveBeenCalled();
      expect(r.output).toContain('Rootfs: Re-extracted');
    });

    it('handles reinstallRootfs failure gracefully', async () => {
      isAvailableMock.mockReturnValue(true);
      reinstallRootfsMock.mockRejectedValue(new Error('Native plugin crashed'));
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        return Promise.resolve(makeExecResult(''));
      });
      vi.useFakeTimers();
      const promise = SandboxEnvService.installEnvironment();
      await vi.advanceTimersByTimeAsync(2000);
      const r = await promise;
      expect(r.output).toContain('Rootfs reinstall failed');
    });

    it('returns early if rootfs reinstall + existing both fail', async () => {
      isAvailableMock.mockReturnValue(true);
      reinstallRootfsMock.mockResolvedValue({ success: true, message: 'Done' });
      // After reinstall, isExecutable still fails
      execMock.mockResolvedValue({ output: 'fatal error: libproot.so', exitCode: 1, sessionId: 'test' });
      vi.useFakeTimers();
      const promise = SandboxEnvService.installEnvironment();
      await vi.advanceTimersByTimeAsync(2000);
      const r = await promise;
      expect(r.success).toBe(false);
      expect(r.output).toContain('could not be made functional');
    });

    it('reports success when all steps complete', async () => {
      isAvailableMock.mockReturnValue(true);
      reinstallRootfsMock.mockResolvedValue({ success: true, message: 'OK' });
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('node --version')) return Promise.resolve(makeExecResult('v20.11.0'));
        if (cmd.includes('npm --version')) return Promise.resolve(makeExecResult('10.2.4'));
        if (cmd.includes('git --version')) return Promise.resolve(makeExecResult('git version 2.43.0'));
        if (cmd.includes('python3 --version')) return Promise.resolve(makeExecResult('Python 3.11.6'));
        if (cmd.includes('gcc --version')) return Promise.resolve(makeExecResult('gcc 13.2'));
        if (cmd.includes('apk update')) return Promise.resolve(makeExecResult('OK'));
        return Promise.resolve(makeExecResult(''));
      });
      vi.useFakeTimers();
      const promise = SandboxEnvService.installEnvironment();
      await vi.advanceTimersByTimeAsync(2000);
      const r = await promise;
      expect(r.success).toBe(true);
      expect(r.output).toContain('All packages verified');
    });

    it('calls onProgress with correct step numbers (1-10)', async () => {
      isAvailableMock.mockReturnValue(true);
      reinstallRootfsMock.mockResolvedValue({ success: true, message: 'OK' });
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        return Promise.resolve(makeExecResult('not found'));
      });
      const progressSteps: number[] = [];
      vi.useFakeTimers();
      const promise = SandboxEnvService.installEnvironment((_, step) => {
        if (step) progressSteps.push(step);
      });
      await vi.advanceTimersByTimeAsync(2000);
      await promise;
      expect(progressSteps[0]).toBe(1); // First step is rootfs
      expect(Math.max(...progressSteps)).toBeLessThanOrEqual(10);
    });
  });

  // =========================================================================
  // repair
  // =========================================================================
  describe('repair', () => {
    it('returns error when terminal not executable', async () => {
      isAvailableMock.mockReturnValue(false);
      const r = await SandboxEnvService.repair();
      expect(r.success).toBe(false);
    });

    it('runs apk update, upgrade, fix when terminal works', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        return Promise.resolve(makeExecResult(''));
      });
      await SandboxEnvService.repair();
      expect(execMock.mock.calls.some((c: string[]) => c[0]?.includes('apk update'))).toBe(true);
      expect(execMock.mock.calls.some((c: string[]) => c[0]?.includes('apk upgrade'))).toBe(true);
      expect(execMock.mock.calls.some((c: string[]) => c[0]?.includes('apk fix'))).toBe(true);
    });
  });

  // =========================================================================
  // reset
  // =========================================================================
  describe('reset', () => {
    it('returns error when terminal not executable', async () => {
      isAvailableMock.mockReturnValue(false);
      const r = await SandboxEnvService.reset();
      expect(r.success).toBe(false);
    });

    it('removes packages and returns success', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockImplementation((cmd: string) => {
        if (cmd.includes('echo ok')) return Promise.resolve(makeExecResult('ok'));
        if (cmd.includes('resolv.conf') && !cmd.includes('echo')) return Promise.resolve(makeExecResult('YES'));
        if (cmd.includes('resolv.conf && echo')) return Promise.resolve(makeExecResult('YES'));
        return Promise.resolve(makeExecResult(''));
      });
      const r = await SandboxEnvService.reset();
      expect(r.success).toBe(true);
      expect(r.output).toContain('Environment reset');
      expect(execMock.mock.calls.some((c: string[]) => c[0]?.includes('apk del'))).toBe(true);
    });
  });

  // =========================================================================
  // proot failure detection
  // =========================================================================
  describe('proot failure detection', () => {
    it.each(PROOT_ERRORS)('detects proot failure in output: "%s"', async (errorMsg) => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult(errorMsg));
      expect(await SandboxEnvService.isExecutable()).toBe(false);
    });

    it('does not false-positive on normal error messages', async () => {
      isAvailableMock.mockReturnValue(true);
      execMock.mockResolvedValue(makeExecResult('command not found: randomcmd'));
      expect(await SandboxEnvService.isExecutable()).toBe(true);
    });
  });
});
