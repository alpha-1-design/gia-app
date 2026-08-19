import { describe, it, expect, vi } from 'vitest';
import { deviceIntegrationTools } from '../deviceIntegration';

const setAlarmTool = deviceIntegrationTools.find((t) => t.id === 'set_alarm')!;

// Bug: the tool used to unconditionally say "Clock app opened with alarm
// pre-filled" regardless of which path actually ran -- including when the
// native AlarmManager path succeeded directly and no Clock app was ever
// opened. These tests pin the message to the real result.
describe('set_alarm tool message', () => {
  it('reports the native AlarmManager path accurately, not "Clock app opened"', async () => {
    vi.doMock('../../DeviceIntegration', () => ({
      default: { setAlarm: vi.fn().mockResolvedValue({ method: 'alarm_manager', batteryOptimized: false }) },
    }));
    vi.resetModules();
    const { deviceIntegrationTools: tools } = await import('../deviceIntegration');
    const tool = tools.find((t) => t.id === 'set_alarm')!;
    const result = await tool.execute({ hour: 7, minute: 30 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('AlarmManager');
    expect(result.content).not.toContain('Clock app opened');
    vi.doUnmock('../../DeviceIntegration');
  });

  it('reports the Clock-app-intent fallback path accurately', async () => {
    vi.doMock('../../DeviceIntegration', () => ({
      default: { setAlarm: vi.fn().mockResolvedValue({ method: 'android_intent' }) },
    }));
    vi.resetModules();
    const { deviceIntegrationTools: tools } = await import('../deviceIntegration');
    const tool = tools.find((t) => t.id === 'set_alarm')!;
    const result = await tool.execute({ hour: 7, minute: 30 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Clock app opened');
    expect(result.content).not.toContain('AlarmManager');
    vi.doUnmock('../../DeviceIntegration');
  });

  it('warns about battery optimization when the native plugin flags it', async () => {
    vi.doMock('../../DeviceIntegration', () => ({
      default: { setAlarm: vi.fn().mockResolvedValue({ method: 'alarm_manager', batteryOptimized: true }) },
    }));
    vi.resetModules();
    const { deviceIntegrationTools: tools } = await import('../deviceIntegration');
    const tool = tools.find((t) => t.id === 'set_alarm')!;
    const result = await tool.execute({ hour: 7, minute: 30 });
    expect(result.content).toContain('battery optimization');
    vi.doUnmock('../../DeviceIntegration');
  });

  it('does not mention battery optimization when not flagged', async () => {
    const result = await setAlarmTool.execute({ hour: 7, minute: 30 });
    expect(result.content).not.toContain('battery optimization');
  });

  it('rejects invalid hour/minute', async () => {
    const result = await setAlarmTool.execute({ hour: 25, minute: 0 });
    expect(result.success).toBe(false);
  });
});
