import { registerPlugin } from '@capacitor/core';

export interface GIASMSPlugin {
  sendSMS(options: { phone: string; message: string }): Promise<{ success: boolean; method: string }>;
}

const GIASMS = registerPlugin<GIASMSPlugin>('GIASMS', {
  web: () => import('./GIASMS.web').then(m => m.GIASMSWeb),
});

export { GIASMS };
