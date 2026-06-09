import type { GIAAlarmPlugin } from './GIAAlarm';

export class GIAAlarmWeb implements GIAAlarmPlugin {
  async setAlarm(options: { hour: number; minute: number; label?: string }): Promise<{ success: boolean; method: string; alarmId: number }> {
    void options;
    throw new Error('Alarm setting requires native Android app');
  }

  async cancelAlarm(options: { alarmId: number }): Promise<void> {
    void options;
    throw new Error('Alarm cancelling requires native Android app');
  }
}
