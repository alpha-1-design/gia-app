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
      queueMicrotask(() => {
        // IDB exposes the value on the request itself once it resolves.
        req.result = data.get(key) ?? null;
        req.onsuccess?.({ result: req.result });
      });
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

  it('write-through storage commits immediately, without the debounce window', async () => {
    vi.useFakeTimers();
    try {
      const mock = makeMockIDB();
      (window as unknown as { indexedDB: unknown }).indexedDB = mock.factory;
      const mod = await import('../idb-storage');

      await mod.idbStorageWriteThrough.setItem('k', 'v');

      // No flushStorage(), no timer advance — the value must already be durable.
      expect(mock.data.get('k')).toBe('v');
      expect(await mod.idbStorageWriteThrough.getItem('k')).toBe('v');
      // Nothing left to lose.
      await mod.flushStorage();
      expect(mock.data.get('k')).toBe('v');
    } finally {
      vi.useRealTimers();
    }
  });

  it('write-through supersedes a pending debounced write for the same key', async () => {
    vi.useFakeTimers();
    try {
      const mock = makeMockIDB();
      (window as unknown as { indexedDB: unknown }).indexedDB = mock.factory;
      const mod = await import('../idb-storage');

      // Debounced write (stale value) is scheduled first…
      await mod.idbStorage.setItem('k', 'stale');
      // …then the write-through save lands.
      await mod.idbStorageWriteThrough.setItem('k', 'fresh');
      expect(mock.data.get('k')).toBe('fresh');

      // Fire the stale debounce timer — it must not resurrect the old value.
      await vi.advanceTimersByTimeAsync(500);
      expect(mock.data.get('k')).toBe('fresh');
    } finally {
      vi.useRealTimers();
    }
  });
});
