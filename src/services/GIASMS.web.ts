import type { GIASMSPlugin } from './GIASMS';
import type { PluginListenerHandle } from '@capacitor/core';

export class GIASMSWeb implements GIASMSPlugin {
  async sendSMS(options: { phone: string; message: string }): Promise<{ success: boolean; method: string }> {
    void options;
    throw new Error('SMS sending requires native Android app');
  }

  async startReceiving(): Promise<void> {
    console.warn('[GIASMS] SMS receiving requires native Android app');
  }

  async stopReceiving(): Promise<void> {
  }

  async addListener(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _eventName: 'smsReceived',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _handler: (result: { from: string; body: string; timestamp: number }) => void
  ): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }
}
