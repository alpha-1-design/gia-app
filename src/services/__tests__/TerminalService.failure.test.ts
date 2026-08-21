import { describe, it, expect, vi, beforeEach } from 'vitest';

const isPluginAvailableMock = vi.fn();
const isNativePlatformMock = vi.fn();
const registerPluginMock = vi.fn();
const execMock = vi.fn();
const reinstallRootfsMock = vi.fn();
const killMock = vi.fn();
const listSessionsMock = vi.fn();
const getFSInfoMock = vi.fn();
const getStatusMock = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isPluginAvailable: (name: string) => isPluginAvailableMock(name),
    isNativePlatform: () => isNativePlatformMock(),
  },
  registerPlugin: (name: string) => registerPluginMock(name),
}));

describe('TerminalService — failure modes', () => {
  beforeEach(() => {
    vi.resetModules();
    isPluginAvailableMock.mockReset();
    isNativePlatformMock.mockReset();
    registerPluginMock.mockReset();
    execMock.mockReset();
    reinstallRootfsMock.mockReset();
    killMock.mockReset();
    listSessionsMock.mockReset();
    getFSInfoMock.mockReset();
    getStatusMock.mockReset();
  });

  async function loadWithPlugin(impl: Record<string, unknown>) {
    isPluginAvailableMock.mockReturnValue(true);
    isNativePlatformMock.mockReturnValue(true);
    registerPluginMock.mockReturnValue(impl);
    const mod = await import('../TerminalService');
    return mod.default;
  }

  async function loadWithoutPlugin() {
    isPluginAvailableMock.mockReturnValue(false);
    isNativePlatformMock.mockReturnValue(false);
    const mod = await import('../TerminalService');
    return mod.default;
  }

  describe('isAvailable', () => {
    it('returns true when plugin is registered', async () => {
      const svc = await loadWithPlugin({ exec: execMock });
      expect(svc.isAvailable()).toBe(true);
    });

    it('returns false when plugin is null', async () => {
      const svc = await loadWithoutPlugin();
      expect(svc.isAvailable()).toBe(false);
    });
  });

  describe('exec', () => {
    it('calls plugin exec with correct args', async () => {
      execMock.mockResolvedValue({ output: 'hello', exitCode: 0, sessionId: 's1' });
      const svc = await loadWithPlugin({ exec: execMock });
      const res = await svc.exec('echo hello');
      expect(execMock).toHaveBeenCalledWith(expect.objectContaining({ command: 'echo hello' }));
      expect(res.output).toBe('hello');
    });

    it('returns mock when plugin unavailable', async () => {
      const svc = await loadWithoutPlugin();
      const res = await svc.exec('echo hi');
      expect(res.exitCode).toBe(-1);
      expect(res.sessionId).toBe('mock');
      expect(res.output).toContain('not available');
    });

    it('wraps errors with context', async () => {
      execMock.mockRejectedValue(new Error('Process crashed'));
      const svc = await loadWithPlugin({ exec: execMock });
      await expect(svc.exec('bad')).rejects.toThrow('Terminal exec failed: Process crashed');
    });

    it('normalizes null output', async () => {
      execMock.mockResolvedValue({ output: null, exitCode: 0, sessionId: 's1' });
      const svc = await loadWithPlugin({ exec: execMock });
      const res = await svc.exec('echo ok');
      expect(res.output).toBe('');
    });
  });

  describe('kill', () => {
    it('calls plugin kill', async () => {
      killMock.mockResolvedValue(undefined);
      const svc = await loadWithPlugin({ exec: execMock, kill: killMock });
      await svc.kill('session-1');
      expect(killMock).toHaveBeenCalledWith({ sessionId: 'session-1' });
    });

    it('does not throw when unavailable', async () => {
      const svc = await loadWithoutPlugin();
      await expect(svc.kill('session-1')).resolves.toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('returns sessions from plugin', async () => {
      listSessionsMock.mockResolvedValue({ sessions: [{ sessionId: 's1', command: 'ls', createdAt: 1000, running: true }] });
      const svc = await loadWithPlugin({ exec: execMock, listSessions: listSessionsMock });
      const sessions = await svc.listSessions();
      expect(sessions).toHaveLength(1);
    });

    it('returns empty when unavailable', async () => {
      const svc = await loadWithoutPlugin();
      expect(await svc.listSessions()).toEqual([]);
    });
  });

  describe('getFSInfo', () => {
    it('returns fs info', async () => {
      getFSInfoMock.mockResolvedValue({ totalBytes: 1000, freeBytes: 500, usedBytes: 500 });
      const svc = await loadWithPlugin({ exec: execMock, getFSInfo: getFSInfoMock });
      expect((await svc.getFSInfo()).totalBytes).toBe(1000);
    });

    it('returns zeros when unavailable', async () => {
      const svc = await loadWithoutPlugin();
      expect((await svc.getFSInfo()).totalBytes).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('returns status', async () => {
      getStatusMock.mockResolvedValue({ running: true, sessionCount: 3 });
      const svc = await loadWithPlugin({ exec: execMock, getStatus: getStatusMock });
      const s = await svc.getStatus();
      expect(s.running).toBe(true);
      expect(s.sessionCount).toBe(3);
    });

    it('returns default when unavailable', async () => {
      const svc = await loadWithoutPlugin();
      expect((await svc.getStatus()).running).toBe(false);
    });
  });

  describe('reinstallRootfs', () => {
    it('calls plugin reinstallRootfs', async () => {
      reinstallRootfsMock.mockResolvedValue({ success: true, message: 'OK' });
      const svc = await loadWithPlugin({ exec: execMock, reinstallRootfs: reinstallRootfsMock });
      const r = await svc.reinstallRootfs();
      expect(r.success).toBe(true);
    });

    it('throws when unavailable', async () => {
      const svc = await loadWithoutPlugin();
      await expect(svc.reinstallRootfs()).rejects.toThrow('not available');
    });

    it('wraps plugin errors', async () => {
      reinstallRootfsMock.mockRejectedValue(new Error('Extract failed'));
      const svc = await loadWithPlugin({ exec: execMock, reinstallRootfs: reinstallRootfsMock });
      await expect(svc.reinstallRootfs()).rejects.toThrow('reinstall failed');
    });
  });

  describe('getSmartTimeout', () => {
    it('returns 10s for dev servers', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('npm run dev')).toBe(10000);
      expect(getSmartTimeout('vite')).toBe(10000);
      expect(getSmartTimeout('next dev')).toBe(10000);
    });

    it('returns 5min for package installs', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('npm install')).toBe(300000);
      expect(getSmartTimeout('pip install flask')).toBe(300000);
      expect(getSmartTimeout('apk add nodejs')).toBe(300000);
    });

    it('returns 4min for builds', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('npm run build')).toBe(240000);
      expect(getSmartTimeout('tsc')).toBe(240000);
      expect(getSmartTimeout('gcc main.c')).toBe(240000);
    });

    it('returns 3min for git/network', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('git clone https://x.com/r')).toBe(180000);
      expect(getSmartTimeout('curl https://api.x.com')).toBe(180000);
      expect(getSmartTimeout('wget https://x.com/f.zip')).toBe(180000);
    });

    it('returns 2min for tests', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('pytest')).toBe(120000);
      expect(getSmartTimeout('node script.js')).toBe(120000);
    });

    it('returns 1min default', async () => {
      const { getSmartTimeout } = await import('../TerminalService');
      expect(getSmartTimeout('echo hello')).toBe(60000);
      expect(getSmartTimeout('ls -la')).toBe(60000);
    });
  });
});
