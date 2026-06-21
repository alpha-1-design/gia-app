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

async function writeNow(name: string, value: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logger.error('[idb-storage] Failed to set item in IndexedDB:', e);
  }
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
  const onLeave = () => { flushStorage(); };
  window.addEventListener('beforeunload', onLeave);
  window.addEventListener('pagehide', onLeave);
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
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        pendingWrites.delete(name);
        await writeNow(name, value);
        resolve();
      }, DEBOUNCE_MS);
      pendingWrites.set(name, { value, timer });
      // Resolve immediately — caller doesn't wait for debounced write
      resolve();
    });
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
