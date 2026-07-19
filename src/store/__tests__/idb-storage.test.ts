import { describe, it, expect, vi, afterEach } from 'vitest';

// Self-contained in-memory IndexedDB mock that actually fires transaction
// callbacks, so we can validate retry + error-surfacing behavior without the
// global test setup's no-op mock (which never fires oncomplete/onerror).
function makeMockIDB() {
  const data = new Map<string, string>();
  let failWrites = false;

  class Store {
    constructor(
      private tx: { oncomplete: null | (() => void); onerror: null | (() => void); onabort: null | (() => void) },
      private fail: boolean,
    ) {}
    put(value: string, key: string) {
      if (!this.fail) data.set(key, value);
      queueMicrotask(() => {
        if (this.fail) this.tx.onerror?.();
        else this.tx.oncomplete?.();
      });
    }
    get(key: string) {
      const req: { onsuccess: null | ((e: unknown) => void); onerror: null | (() => void); result?: string | null } = {
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => req.onsuccess?.({ result: data.get(key) ?? null }));
      return req;
    }
    delete(key: string) {
      data.delete(key);
      queueMicrotask(() => this.tx.oncomplete?.());
    }
  }

  class DB {
    createObjectStore() {}
    transaction() {
      const tx: { oncomplete: null | (() => void); onerror: null | (() => void); onabort: null | (() => void); objectStore?: () => Store } = {
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      tx.objectStore = () => new Store(tx, failWrites);
      return tx;
    }
  }

  const factory = {
    open() {
      const req: { onsuccess: null | (() => void); onupgradeneeded: null | (() => void); onerror: null | (() => void); onblocked: null | (() => void); result: DB } = {
        onsuccess: null,
        onupgradeneeded: null,
        onerror: null,
        onblocked: null,
        result: new DB(),
      };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  };

  return {
    factory,
    data,
    setFailWrites: (v: boolean) => { failWrites = v; },
  };
}

describe('idb-storage', () => {
  afterEach(() => { vi.resetModules(); });

  it('persists a value and does not invoke the error handler on success', async () => {
    const mock = makeMockIDB();
    (window as unknown as { indexedDB: unknown }).indexedDB = mock.factory;
    const mod = await import('../idb-storage');
    const errors: unknown[] = [];
    mod.setStorageErrorHandler((info) => errors.push(info));
    await mod.idbStorage.setItem('k', 'v');
    await mod.flushStorage();
    expect(mock.data.get('k')).toBe('v');
    expect(errors).toHaveLength(0);
  });

  it('retries once and reports via the handler when writes fail', async () => {
    const mock = makeMockIDB();
    mock.setFailWrites(true);
    (window as unknown as { indexedDB: unknown }).indexedDB = mock.factory;
    const mod = await import('../idb-storage');
    const errors: unknown[] = [];
    mod.setStorageErrorHandler((info) => errors.push(info));
    await mod.idbStorage.setItem('k', 'v');
    await mod.flushStorage();
    // flushStorage awaits writeNow; after the retry fails the handler fires.
    expect(errors.length).toBeGreaterThan(0);
  });
});
