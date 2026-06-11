import { logger } from '../utils/logger';

// ─── IndexedDB Wrapper ────────────────────────────────────────────────

const DB_NAME = 'gia-persistence';
const STORE_NAME = 'data';
const DB_VERSION = 1;
const CURRENT_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      } catch (e) {
        logger.error('[PersistenceManager] Failed to create object store:', e);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB blocked — close other tabs'));
    };
  });
  return dbPromise;
}

// ─── PersistenceManager ───────────────────────────────────────────────

interface PersistedEntry {
  version: number;
  data: unknown;
  timestamp: number;
}

interface ExportData {
  fromVersion: number;
  toVersion: number;
  exportedAt: string;
  stores: Record<string, unknown>;
  settings: Record<string, unknown>;
  providers: Record<string, unknown>;
  plugins: Record<string, unknown>;
  customProviders: unknown[];
  terminalFS: Record<string, unknown>;
  [key: string]: unknown;
}

interface ImportResult {
  success: boolean;
  errors: string[];
}

class PersistenceManager {
  private static instance: PersistenceManager;
  private constructor() {}

  static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }

  /**
   * Save any serializable data under a given key.
   */
  async save(key: string, data: unknown): Promise<void> {
    try {
      const db = await getDB();
      const entry: PersistedEntry = {
        version: CURRENT_VERSION,
        data,
        timestamp: Date.now(),
      };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(entry, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      logger.error(`[PersistenceManager] Failed to save "${key}":`, e);
      throw e;
    }
  }

  /**
   * Load data saved under a given key.
   */
  async load<T = unknown>(key: string): Promise<T | null> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(key);
        getRequest.onsuccess = () => {
          const entry = getRequest.result as PersistedEntry | undefined;
          if (!entry) {
            resolve(null);
            return;
          }
          resolve(entry.data as T);
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (e) {
      logger.error(`[PersistenceManager] Failed to load "${key}":`, e);
      return null;
    }
  }

  /**
   * Remove a key from persistence.
   */
  async remove(key: string): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      logger.error(`[PersistenceManager] Failed to remove "${key}":`, e);
    }
  }

  /**
   * Collect ALL known data from IndexedDB stores, Zustand stores, and settings.
   * Returns a JSON string suitable for export.
   */
  async exportAll(): Promise<string> {
    const exportData: ExportData = {
      fromVersion: CURRENT_VERSION,
      toVersion: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {},
      settings: {},
      providers: {},
      plugins: {},
      customProviders: [],
      terminalFS: {},
    };

    try {
      // 1. Collect all keys from the persistence store
      const db = await getDB();
      const allKeys = await new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => resolve(keysReq.result as string[]);
        keysReq.onerror = () => reject(keysReq.error);
      });

      // 2. Load each key and categorize
      for (const key of allKeys) {
        try {
          const entry = await new Promise<PersistedEntry | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          if (!entry) continue;

          // Categorize by key prefix
          if (key.startsWith('gia-')) {
            if (key.includes('provider') || key.includes('Provider')) {
              exportData.providers[key] = entry.data;
            } else if (key.includes('plugin') || key.includes('Plugin')) {
              exportData.plugins[key] = entry.data;
            } else if (key.includes('setting') || key.includes('config') || key.includes('Config')) {
              exportData.settings[key] = entry.data;
            } else {
              exportData.stores[key] = entry.data;
            }
          } else {
            exportData.stores[key] = entry.data;
          }
        } catch (e) {
          logger.warn(`[PersistenceManager] Failed to read key "${key}" during export:`, e);
        }
      }

      // 3. Add custom providers separately
      try {
        const { useCustomProviderStore } = await import('./providers/customProviders');
        exportData.customProviders = useCustomProviderStore.getState().customProviders;
      } catch {
        // customProviders might not be available
      }

      // 4. Try to capture terminal/filesystem info
      try {
        const { TerminalService } = await import('./TerminalService');
        exportData.terminalFS = {
          sessionInfo: 'exported',
        };
      } catch {
        // TerminalService might not expose what we need, that's ok
      }

    } catch (e) {
      logger.error('[PersistenceManager] Export failed:', e);
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import and restore data from a JSON export string.
   */
  async importAll(json: string): Promise<ImportResult> {
    const errors: string[] = [];

    let data: ExportData;
    try {
      data = JSON.parse(json);
    } catch {
      return { success: false, errors: ['Invalid JSON format'] };
    }

    if (!data.stores && !data.providers && !data.settings && !data.plugins) {
      return { success: false, errors: ['Export data appears invalid; missing required fields'] };
    }

    // Restore stores
    if (data.stores) {
      for (const [key, value] of Object.entries(data.stores)) {
        try {
          await this.save(key, value);
        } catch (e) {
          errors.push(`Failed to restore store "${key}": ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    // Restore providers
    if (data.providers) {
      for (const [key, value] of Object.entries(data.providers)) {
        try {
          await this.save(key, value);
        } catch (e) {
          errors.push(`Failed to restore provider "${key}": ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    // Restore settings
    if (data.settings) {
      for (const [key, value] of Object.entries(data.settings)) {
        try {
          await this.save(key, value);
        } catch (e) {
          errors.push(`Failed to restore setting "${key}": ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    // Restore plugins
    if (data.plugins) {
      for (const [key, value] of Object.entries(data.plugins)) {
        try {
          await this.save(key, value);
        } catch (e) {
          errors.push(`Failed to restore plugin "${key}": ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }

    // Restore custom providers
    if (data.customProviders && Array.isArray(data.customProviders)) {
      try {
        const { useCustomProviderStore } = await import('./providers/customProviders');
        for (const cp of data.customProviders) {
          useCustomProviderStore.getState().addCustomProvider(cp);
        }
      } catch (e) {
        errors.push(`Failed to restore custom providers: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Restore terminalFS (informational only)
    if (data.terminalFS) {
      // Terminal FS info is informational; we don't actively restore it
    }

    // After import, reload the provider registry to pick up custom providers
    try {
      const { mergeIntoRegistry } = await import('./providers/customProviders');
      mergeIntoRegistry();
    } catch {
      // ignore
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Wipe all persisted data.
   */
  async clearAll(): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      logger.error('[PersistenceManager] Failed to clear all data:', e);
      throw e;
    }
  }

  /**
   * List all stored keys.
   */
  async listKeys(): Promise<string[]> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      logger.error('[PersistenceManager] Failed to list keys:', e);
      return [];
    }
  }
}

export const persistenceManager = PersistenceManager.getInstance();
export type { ExportData, ImportResult };
export default PersistenceManager;
