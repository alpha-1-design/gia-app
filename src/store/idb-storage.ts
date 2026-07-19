import { logger } from '../utils/logger';

const DB_NAME = 'gia-db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      try {
        request.result.createObjectStore(STORE_NAME);
      } catch (e) {
        logger.error('[idb-storage] Failed to create object store:', e);
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

// Debounce writes during rapid updates (streaming) — last write wins within 300ms
const pendingWrites = new Map<string, { value: string; timer: ReturnType<typeof setTimeout> }>();
const DEBOUNCE_MS = 300;

/**
 * Optional handler the app registers to learn about persistence failures
 * (e.g. storage quota exceeded). Without it, a failed write would be lost
 * silently — so we surface it instead of swallowing.
 */
type StorageErrorHandler = (info: { key: string; error: unknown }) => void;
let writeErrorHandler: StorageErrorHandler | null = null;
export function setStorageErrorHandler(handler: StorageErrorHandler | null): void {
  writeErrorHandler = handler;
}

async function writeNow(name: string, value: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await getDB();
  } catch (e) {
    logger.error('[idb-storage] Cannot open database — write dropped:', e);
    writeErrorHandler?.({ key: name, error: e });
    return;
  }

  // Resolve with whether the transaction committed. A failed commit (e.g.
  // QuotaExceededError) fires onerror/onabort, which we treat as a failure.
  const attempt = (): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, name);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });

  // Best-effort: try once, and on failure retry a single time (covers
  // transient lock/quota races). If both fail, surface it so the user knows
  // data may not have been saved rather than failing silently.
  if (await attempt()) return;
  logger.warn('[idb-storage] First write attempt failed, retrying once:', name);
  if (await attempt()) return;
  logger.error('[idb-storage] Persisted write failed after retry — data may be lost:', name);
  writeErrorHandler?.({ key: name, error: new Error('IndexedDB write did not persist') });
}

/** Flush all pending writes immediately — call on page unload */
export async function flushStorage(): Promise<void> {
  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();
  for (const [name, { value, timer }] of entries) {
    clearTimeout(timer);
    await writeNow(name, value);
  }
}

if (typeof window !== 'undefined') {
  const onLeave = () => { void flushStorage(); };
  window.addEventListener('beforeunload', onLeave);
  window.addEventListener('pagehide', onLeave);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushStorage();
  });
  // Browsers that support the Page Lifecycle 'freeze' event (Chrome/Android)
  // fire this when the page is being cached/backgrounded — flush early.
  window.addEventListener('freeze', onLeave);

  // Android WebView: beforeunload/pagehide are not reliable when the app is
  // backgrounded or the process is reclaimed by the OS. Hook the native
  // Capacitor lifecycle event so debounced writes aren't lost on a phone
  // getting killed in the background (common on low-RAM devices).
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) void flushStorage();
    });
  }).catch(() => {
    // Not running under Capacitor (e.g. plain web/test env) — web listeners above are enough
  });
}

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(name);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (e) {
      logger.error('[idb-storage] Failed to get item from IndexedDB:', e);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const existing = pendingWrites.get(name);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      pendingWrites.delete(name);
      void writeNow(name, value);
    }, DEBOUNCE_MS);
    pendingWrites.set(name, { value, timer });
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      logger.error('[idb-storage] Failed to remove item from IndexedDB:', e);
    }
  },
};
