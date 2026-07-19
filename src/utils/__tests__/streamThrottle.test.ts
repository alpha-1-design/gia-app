import { describe, it, expect, vi, afterEach } from 'vitest';

// Control rAF + MessageChannel so we can drive the throttle deterministically.
let rafMap = new Map<number, (t: number) => void>();
let rafId = 0;
let lastChannel: { port1: { onmessage: ((e: unknown) => void) | null; close(): void }; port2: { postMessage: () => void; close(): void } } | null = null;

class FakeMessagePort {
  onmessage: ((e: unknown) => void) | null = null;
  close() {}
}
function FakeMessageChannel(): { port1: FakeMessagePort; port2: { postMessage: () => void; close(): void } } {
  const port1 = new FakeMessagePort();
  const port2 = {
    postMessage: () => {
      queueMicrotask(() => lastChannel?.port1.onmessage?.({ data: 1 }));
    },
    close() {},
  };
  lastChannel = { port1, port2 };
  return { port1, port2 };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const fireRaf = () => {
  const entries = [...rafMap.entries()];
  rafMap.clear();
  entries.forEach(([, cb]) => cb(performance.now()));
};

async function loadThrottle() {
  vi.resetModules();
  rafMap = new Map();
  rafId = 0;
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: (t: number) => void) => {
    const id = ++rafId;
    rafMap.set(id, cb);
    return id;
  };
  (globalThis as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (id: number) => {
    rafMap.delete(id);
  };
  (globalThis as unknown as { MessageChannel: unknown }).MessageChannel = FakeMessageChannel;
  return import('../streamThrottle');
}

describe('streamThrottle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('flushes a single token exactly once', async () => {
    const mod = await loadThrottle();
    const updateMessage = vi.fn();
    const store = await import('../../store/useGiaStore');
    vi.spyOn(store.useGiaStore, 'getState').mockReturnValue({ updateMessage, updateMessageTasks: vi.fn() } as never);

    mod.streamPush('k', 's', 'a', 'hello', undefined, null, () => false);
    await tick(); // microtask (MessageChannel) flush fires
    fireRaf(); // rAF also "fires" but must be a no-op (already flushed)

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith('s', 'a', 'hello', undefined);
  });

  it('coalesces multiple tokens into the latest content (one flush)', async () => {
    const mod = await loadThrottle();
    const updateMessage = vi.fn();
    const store = await import('../../store/useGiaStore');
    vi.spyOn(store.useGiaStore, 'getState').mockReturnValue({ updateMessage, updateMessageTasks: vi.fn() } as never);

    mod.streamPush('k', 's', 'a', 'a', undefined, null, () => false);
    mod.streamPush('k', 's', 'a', 'ab', undefined, null, () => false);
    mod.streamPush('k', 's', 'a', 'abc', undefined, null, () => false);

    expect(updateMessage).not.toHaveBeenCalled(); // nothing flushed yet
    await tick();
    fireRaf();

    expect(updateMessage).toHaveBeenCalledTimes(1);
    expect(updateMessage).toHaveBeenCalledWith('s', 'a', 'abc', undefined);
  });

  it('does not flush when aborted', async () => {
    const mod = await loadThrottle();
    const updateMessage = vi.fn();
    const store = await import('../../store/useGiaStore');
    vi.spyOn(store.useGiaStore, 'getState').mockReturnValue({ updateMessage, updateMessageTasks: vi.fn() } as never);

    mod.streamPush('k', 's', 'a', 'secret', undefined, null, () => true);
    await tick();
    fireRaf();

    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('flushes tasks alongside content', async () => {
    const mod = await loadThrottle();
    const updateMessage = vi.fn();
    const updateMessageTasks = vi.fn();
    const store = await import('../../store/useGiaStore');
    vi.spyOn(store.useGiaStore, 'getState').mockReturnValue({ updateMessage, updateMessageTasks } as never);

    const tasks = [{ id: 't1', label: 'doing', status: 'running' }] as never;
    mod.streamPush('k', 's', 'a', 'content', 'thinking…', tasks, () => false);
    await tick();
    fireRaf();

    expect(updateMessage).toHaveBeenCalledWith('s', 'a', 'content', 'thinking…');
    expect(updateMessageTasks).toHaveBeenCalledWith('s', 'a', tasks);
  });

  it('streamCancel prevents a pending flush', async () => {
    const mod = await loadThrottle();
    const updateMessage = vi.fn();
    const store = await import('../../store/useGiaStore');
    vi.spyOn(store.useGiaStore, 'getState').mockReturnValue({ updateMessage, updateMessageTasks: vi.fn() } as never);

    mod.streamPush('k', 's', 'a', 'never', undefined, null, () => false);
    mod.streamCancel('k');
    await tick();
    fireRaf();

    expect(updateMessage).not.toHaveBeenCalled();
  });
});
