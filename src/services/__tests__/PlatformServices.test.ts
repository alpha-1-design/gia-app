import { describe, it, expect } from 'vitest';
import { GIAAlarmWeb } from '../GIAAlarm.web';
import { GIAIntentWeb } from '../GIAIntent.web';
import { GIASMSWeb } from '../GIASMS.web';

describe('GIAAlarmWeb', () => {
  const web = new GIAAlarmWeb();

  it('setAlarm throws on web platform', async () => {
    await expect(web.setAlarm({ hour: 8, minute: 0 })).rejects.toThrow(
      'Alarm setting requires native Android app'
    );
  });

  it('cancelAlarm throws on web platform', async () => {
    await expect(web.cancelAlarm({ alarmId: 1 })).rejects.toThrow(
      'Alarm cancelling requires native Android app'
    );
  });
});

describe('GIASMSWeb', () => {
  const web = new GIASMSWeb();

  it('sendSMS throws on web platform', async () => {
    await expect(web.sendSMS({ phone: '+1234567890', message: 'hello' })).rejects.toThrow(
      'SMS sending requires native Android app'
    );
  });
});

describe('GIAIntentWeb', () => {
  const web = new GIAIntentWeb();

  it('getPendingIntent returns empty object', async () => {
    const result = await web.getPendingIntent();
    expect(result).toEqual({});
  });

  it('clearIntent resolves without error', async () => {
    await expect(web.clearIntent()).resolves.toBeUndefined();
  });

  it('addListener returns a removable listener handle', async () => {
    const handle = await web.addListener('onAssist', () => {});
    expect(handle).toHaveProperty('remove');
    await expect(handle.remove()).resolves.toBeUndefined();
  });

  it('removeAllListeners resolves without error', async () => {
    await expect(web.removeAllListeners()).resolves.toBeUndefined();
  });

  it('addListener works with onDeepLink event', async () => {
    const handle = await web.addListener('onDeepLink', () => {});
    expect(handle).toHaveProperty('remove');
    await expect(handle.remove()).resolves.toBeUndefined();
  });

  it('addListener works with onShareReceived event', async () => {
    const handle = await web.addListener('onShareReceived', () => {});
    expect(handle).toHaveProperty('remove');
  });
});
