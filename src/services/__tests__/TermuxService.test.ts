import { describe, expect, it, vi } from 'vitest';

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

describe('TermuxService', () => {
  it('reports Termux availability and forwards commands', async () => {
    mocks.termuxStatus.mockResolvedValue({ installed: true });
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
    mocks.termuxStatus.mockResolvedValue({ installed: false });
    const { default: service } = await import('../TermuxService');
    await expect(service.run('python')).rejects.toThrow('Termux is not installed');
  });
});
