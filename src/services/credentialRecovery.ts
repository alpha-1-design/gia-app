/**
 * credentialRecovery — self-healing for lost provider API keys.
 *
 * A WebView killed right after the user connects an API key can lose the
 * debounced IndexedDB write while chats (written constantly) survive. The key
 * itself usually still exists in the native credential vault, which is written
 * synchronously on save. On boot we re-seed any empty provider key from:
 *
 *   1. the credential store (IndexedDB), then
 *   2. the native vault (Android EncryptedSharedPreferences).
 *
 * Only empty keys are ever touched — a live key is never overwritten.
 */
import { useProviderStore } from '../store/useProviderStore';
import { useCredentialStore } from '../store/useCredentialStore';
import { providerRegistry } from './ProviderRegistry';
import credentialVault from './CredentialVault';
import { logger } from '../utils/logger';

interface Hydratable {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

/** Resolves once a persist store has finished its initial hydration. */
export function whenHydrated(store: Hydratable): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Restore missing provider API keys from the credential store / native vault.
 * Returns the provider ids that were recovered (for logging/tests).
 */
export async function healProviderKeys(): Promise<string[]> {
  const recovered: string[] = [];
  try {
    await whenHydrated(useProviderStore);
    await whenHydrated(useCredentialStore);
    await providerRegistry.ensureLoaded();

    const { providers } = useProviderStore.getState();
    for (const [id, cfg] of Object.entries(providers)) {
      if (cfg.apiKey?.trim()) continue;
      if (!providerRegistry.getNeedsApiKey(id)) continue;

      let value: string | undefined = useCredentialStore.getState().credentials[id]?.value;
      if (!value?.trim()) value = await credentialVault.getNative(id);

      if (value && value.trim()) {
        useProviderStore.getState().setProviderKey(id, value);
        recovered.push(id);
        logger.warn(`[credentialRecovery] Restored lost API key for provider "${id}" from the credential vault.`);
      }
    }
  } catch (e) {
    logger.error('[credentialRecovery] Recovery pass failed:', e);
  }
  return recovered;
}
