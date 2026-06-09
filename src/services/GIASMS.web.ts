import type { GIASMSPlugin } from './GIASMS';

export class GIASMSWeb implements GIASMSPlugin {
  async sendSMS(options: { phone: string; message: string }): Promise<{ success: boolean; method: string }> {
    void options;
    throw new Error('SMS sending requires native Android app');
  }
}
