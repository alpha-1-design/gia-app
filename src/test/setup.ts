import '@testing-library/jest-dom';

// Mock IndexedDB
class MockIDBObjectStore {
  constructor() {}
  get = vi.fn();
  put = vi.fn();
  delete = vi.fn();
}

class MockIDBTransaction {
  constructor() {}
  objectStore = vi.fn(() => new MockIDBObjectStore());
  oncomplete = null;
  onerror = null;
}

class MockIDBDatabase {
  constructor() {}
  createObjectStore = vi.fn();
  transaction = vi.fn(() => new MockIDBTransaction());
}

class MockIDBFactory {
  open = vi.fn(() => {
    const request: any = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
      result: new MockIDBDatabase(),
    };
    // Simulate async nature
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  });
}

if (typeof window !== 'undefined') {
  // Ensure indexedDB is available globally
  Object.defineProperty(window, 'indexedDB', {
    value: new MockIDBFactory(),
    writable: true,
  });
  // Also mock IDBFactory directly if needed by some libs
  Object.defineProperty(window, 'IDBFactory', {
    value: MockIDBFactory,
    writable: true,
  });
}

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.createBufferSource = vi.fn(() => ({ buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }));
    this.createGain = vi.fn(() => ({ connect: vi.fn() }));
    this.suspend = vi.fn(() => Promise.resolve());
    this.resume = vi.fn(() => Promise.resolve());
    this.close = vi.fn(() => Promise.resolve());
  }
  // Add other methods/properties if used by the app
}

if (typeof window !== 'undefined') {
  // Ensure AudioContext is available globally as a constructor
  Object.defineProperty(window, 'AudioContext', {
    value: MockAudioContext,
    writable: true,
  });
  // Mock AudioContext constructor directly as well
  Object.defineProperty(window, 'webkitAudioContext', {
    value: MockAudioContext,
    writable: true,
  });
}
