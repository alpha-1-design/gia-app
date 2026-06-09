import { registerPlugin } from '@capacitor/core';

export interface GIAAlarmPlugin {
  setAlarm(options: { hour: number; minute: number; label?: string }): Promise<{ success: boolean; method: string; alarmId: number }>;
  cancelAlarm(options: { alarmId: number }): Promise<void>;
}

const GIAAlarm = registerPlugin<GIAAlarmPlugin>('GIAAlarm', {
  web: () => import('./GIAAlarm.web').then(m => m.GIAAlarmWeb),
});

export { GIAAlarm };
