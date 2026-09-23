import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import credentialVault from '../services/CredentialVault';

export interface CredentialRecord {
  serviceId: string;
  label: string;
  kind: 'api_key' | 'token' | 'secret';
  value: string;
  updatedAt: number;
  accountLabel?: string;
}

interface CredentialState {
  credentials: Record<string, CredentialRecord>;
  setCredential: (credential: Omit<CredentialRecord, 'updatedAt'>) => void;
  getCredential: (serviceId: string) => CredentialRecord | undefined;
  removeCredential: (serviceId: string) => void;
}

export function getStoredCredential(serviceId: string): CredentialRecord | undefined {
  return useCredentialStore.getState().credentials[serviceId];
}

export const useCredentialStore = create<CredentialState>()(
  persist(
    (set, get) => ({
      credentials: {},
      setCredential: (credential) => {
        const record = { ...credential, updatedAt: Date.now() };
        credentialVault.set(record).catch(() => {});
        set(state => ({
          credentials: {
          ...state.credentials,
          [credential.serviceId]: record,
          },
        }));
      },
      getCredential: (serviceId) => get().credentials[serviceId],
      removeCredential: (serviceId) => {
        credentialVault.remove(serviceId).catch(() => {});
        set(state => {
        const credentials = { ...state.credentials };
        delete credentials[serviceId];
        return { credentials };
        });
      },
    }),
    {
      name: 'gia-credentials',
      storage: createJSONStorage(() => idbStorage),
      partialize: state => ({ credentials: state.credentials }),
    },
  ),
);

useCredentialStore.persist.onFinishHydration(() => {
  const records = useCredentialStore.getState().credentials;
  credentialVault.hydrate(records).catch(() => {});
});

export default useCredentialStore;
