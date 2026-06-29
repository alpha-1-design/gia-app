import { registerPlugin } from '@capacitor/core';

export interface GIASMSPlugin {
  sendSMS(options: { phone: string; message: string }): Promise<{ success: boolean; method: string }>;
  startReceiving(): Promise<void>;
  stopReceiving(): Promise<void>;
  addListener(
    eventName: 'smsReceived',
    handler: (result: { from: string; body: string; timestamp: number }) => void
  ): Promise<{ remove: () => void }>;
}

const GIASMS = registerPlugin<GIASMSPlugin>('GIASMS', {
  web: () => import('./GIASMS.web').then(m => m.GIASMSWeb),
});

export { GIASMS };
