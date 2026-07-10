import { describe, it, expect, vi, beforeEach } from 'vitest';

const isPluginAvailableMock = vi.fn();
const registerPluginMock = vi.fn();
const execMock = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isPluginAvailable: (name: string) => isPluginAvailableMock(name) },
  registerPlugin: (name: string) => registerPluginMock(name),
}));

describe('TerminalService — native plugin resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    isPluginAvailableMock.mockReset();
    registerPluginMock.mockReset();
    execMock.mockReset();
  });

  it('resolves the GIATerminal plugin via registerPlugin() when available, and can call it', async () => {
    isPluginAvailableMock.mockReturnValue(true);
    registerPluginMock.mockReturnValue({
      exec: execMock.mockResolvedValue({ output: 'hi', exitCode: 0, sessionId: 's1' }),
    });

    const { default: terminalService } = await import('../TerminalService');

    expect(isPluginAvailableMock).toHaveBeenCalledWith('GIATerminal');
    expect(registerPluginMock).toHaveBeenCalledWith('GIATerminal');

    const res = await terminalService.exec('echo hi');
    expect(res.output).toBe('hi');
    expect(execMock).toHaveBeenCalled();
  });

  it('falls back gracefully (no throw) when the plugin is not available', async () => {
    isPluginAvailableMock.mockReturnValue(false);

    const { default: terminalService } = await import('../TerminalService');
    const res = await terminalService.exec('echo hi');

    expect(res.exitCode).toBe(-1);
    expect(res.output).toContain('not available');
  });
});
