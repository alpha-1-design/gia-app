import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  termuxStatus: vi.fn(),
  openTermux: vi.fn(),
  runTermuxCommand: vi.fn(),
}));

vi.mock('../GIAIntent', () => ({
  GIAIntent: mocks,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

const readyStatus = {
  installed: true,
  ready: true,
  bridgeResponsive: true,
  allowExternalApps: true,
  declaredAllowExternalApps: true,
  reason: 'probe_ok',
  hint: 'Termux responded to a live probe; approved commands will run.',
};

const notReadyStatus = {
  installed: true,
  ready: false,
  bridgeResponsive: false,
  allowExternalApps: false,
  declaredAllowExternalApps: null,
  reason: 'probe_timeout',
  hint:
    'Termux did not respond to GIA. Open Termux and add `allow-external-apps = true` to ~/.termux/termux.properties, then restart Termux.',
};

describe('TermuxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports Termux availability and forwards commands', async () => {
    mocks.termuxStatus.mockResolvedValue(readyStatus);
    mocks.runTermuxCommand.mockResolvedValue({ jobId: 'job-1', stdout: 'Python 3.12', exitCode: 0 });
    const { default: service } = await import('../TermuxService');

    expect(await service.isInstalled()).toBe(true);
    await expect(service.run('python', ['-V'], '/data/data/com.termux/files/home')).resolves.toMatchObject({ jobId: 'job-1', exitCode: 0 });
    expect(mocks.runTermuxCommand).toHaveBeenCalledWith({
      command: 'python',
      args: ['-V'],
      workdir: '/data/data/com.termux/files/home',
    });
  });

  it('refuses to run when Termux is not installed', async () => {
    mocks.termuxStatus.mockResolvedValue({ ...readyStatus, installed: false, ready: false });
    const { default: service } = await import('../TermuxService');
    await expect(service.run('python')).rejects.toThrow('Termux is not installed');
  });

  it('rejects with an actionable timeout error instead of hanging forever', async () => {
    mocks.termuxStatus.mockResolvedValue(readyStatus);
    // Native bridge never answers.
    mocks.runTermuxCommand.mockReturnValue(new Promise(() => {}));
    const { default: service } = await import('../TermuxService');

    const pending = service.run('sleep', ['999']);
    const assertion = expect(pending).rejects.toThrow(/did not respond within 30s/);
    // Advance past the 30s watchdog.
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('timeout error names allow-external-apps as the likely cause', async () => {
    mocks.termuxStatus.mockResolvedValue(readyStatus);
    mocks.runTermuxCommand.mockReturnValue(new Promise(() => {}));
    const { default: service } = await import('../TermuxService');

    const pending = service.run('ls');
    const assertion = expect(pending).rejects.toThrow(/allow-external-apps/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('clears the timer when Termux answers in time', async () => {
    mocks.termuxStatus.mockResolvedValue(readyStatus);
    mocks.runTermuxCommand.mockResolvedValue({ jobId: 'job-2', exitCode: 0 });
    const { default: service } = await import('../TermuxService');

    await expect(service.run('ls')).resolves.toMatchObject({ jobId: 'job-2' });
    // No pending timer should remain to fire later.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('surfaces native bridge readiness through status()', async () => {
    mocks.termuxStatus.mockResolvedValue(notReadyStatus);
    const { default: service } = await import('../TermuxService');

    const status = await service.status();
    expect(status.installed).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.bridgeResponsive).toBe(false);
    expect(status.declaredAllowExternalApps).toBeNull();
    expect(status.hint).toMatch(/allow-external-apps/);
  });

  it('status() never throws, even if the native call fails', async () => {
    mocks.termuxStatus.mockRejectedValue(new Error('bridge exploded'));
    const { default: service } = await import('../TermuxService');

    const status = await service.status();
    expect(status.ready).toBe(false);
    expect(status.reason).toBe('status_failed');
  });
});

describe('termux tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('termux_status says READY only when the bridge is actually usable', async () => {
    mocks.termuxStatus.mockResolvedValue(readyStatus);
    const { termuxTools } = await import('../tools/termux');
    const tool = termuxTools.find(t => t.id === 'termux_status')!;

    const result = await tool.execute({});
    expect(result.success).toBe(true);
    expect(result.content).toMatch(/READY/);
    expect(result.content).toMatch(/responded to a live round-trip probe/);
  });

  it('termux_status reports NOT READY with a fix when installed but unreachable', async () => {
    mocks.termuxStatus.mockResolvedValue(notReadyStatus);
    const { termuxTools } = await import('../tools/termux');
    const tool = termuxTools.find(t => t.id === 'termux_status')!;

    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.content).toMatch(/INSTALLED but NOT READY/);
    expect(result.content).toMatch(/allow-external-apps/);
  });

  it('termux_run fails fast with the fix hint instead of hanging when not ready', async () => {
    mocks.termuxStatus.mockResolvedValue(notReadyStatus);
    const { termuxTools } = await import('../tools/termux');
    const tool = termuxTools.find(t => t.id === 'termux_run')!;

    const result = await tool.execute({ command: 'ls' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/allow-external-apps/);
    // Critically: it must not even attempt to dispatch.
    expect(mocks.runTermuxCommand).not.toHaveBeenCalled();
  });
});
