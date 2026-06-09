import type { GIAAlarmPlugin } from './GIAAlarm';

export class GIAAlarmWeb implements GIAAlarmPlugin {
  async setAlarm(_options: { hour: number; minute: number; label?: string }): Promise<{ success: boolean; method: string; alarmId: number }> {
    throw new Error('Alarm setting requires native Android app');
  }

  async cancelAlarm(_options: { alarmId: number }): Promise<void> {
    throw new Error('Alarm cancelling requires native Android app');
  }
}
