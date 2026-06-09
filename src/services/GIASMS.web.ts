import type { GIASMSPlugin } from './GIASMS';

export class GIASMSWeb implements GIASMSPlugin {
  async sendSMS(_options: { phone: string; message: string }): Promise<{ success: boolean; method: string }> {
    throw new Error('SMS sending requires native Android app');
  }
}
