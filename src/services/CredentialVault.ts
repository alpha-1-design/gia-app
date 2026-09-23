import { Capacitor, registerPlugin } from '@capacitor/core';
import type { CredentialRecord } from '../store/useCredentialStore';

interface NativeVault {
  get(options: { serviceId: string }): Promise<{ value?: string; record?: string }>;
  set(options: { serviceId: string; value: string; metadata: string }): Promise<void>;
  remove(options: { serviceId: string }): Promise<void>;
}

const NativeCredentialVault = registerPlugin<NativeVault>('GIACredentialVault');

class CredentialVault {
  private cache = new Map<string, CredentialRecord>();
  private hydrated = false;
  private hydration: Promise<void> | null = null;

  async hydrate(records: Record<string, CredentialRecord>): Promise<void> {
    if (this.hydrated) return;
    if (this.hydration) return this.hydration;
    this.hydration = (async () => {
      for (const [serviceId, record] of Object.entries(records)) {
        this.cache.set(serviceId, record);
        if (Capacitor.isNativePlatform()) {
          try {
            const stored = await NativeCredentialVault.get({ serviceId });
            if (stored.value) {
              this.cache.set(serviceId, { ...record, value: stored.value });
            } else {
              await NativeCredentialVault.set({ serviceId, value: record.value, metadata: JSON.stringify({ ...record, value: undefined }) });
            }
          } catch {
            // Keep the IndexedDB value as a compatibility fallback.
          }
        }
      }
      this.hydrated = true;
    })();
    return this.hydration;
  }

  get(serviceId: string): CredentialRecord | undefined {
    return this.cache.get(serviceId);
  }

  async set(record: CredentialRecord): Promise<void> {
    this.cache.set(record.serviceId, record);
    if (Capacitor.isNativePlatform()) {
      await NativeCredentialVault.set({
        serviceId: record.serviceId,
        value: record.value,
        metadata: JSON.stringify({ ...record, value: undefined }),
      });
    }
  }

  async remove(serviceId: string): Promise<void> {
    this.cache.delete(serviceId);
    if (Capacitor.isNativePlatform()) await NativeCredentialVault.remove({ serviceId });
  }
}

export default new CredentialVault();
