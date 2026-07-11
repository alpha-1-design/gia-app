import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const foregroundStartMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../GIAForegroundService', () => ({
  default: { start: (...args: unknown[]) => foregroundStartMock(...args), stop: vi.fn() },
}));

const { default: messagingBridge } = await import('../MessagingBridge');

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response;
}

describe('MessagingBridge — Telegram polling', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    foregroundStartMock.mockClear();
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/getMe')) {
        return Promise.resolve(jsonResponse({ ok: true, result: { username: 'gia_bot' } }));
      }
      if (url.includes('/getUpdates')) {
        return Promise.resolve(jsonResponse({ ok: true, result: [] }));
      }
      return Promise.resolve(jsonResponse({ ok: false }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await messagingBridge.configureTelegram('test-token');
  });

  afterEach(() => {
    messagingBridge.stopPolling();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('engages native foreground keep-alive when polling starts', async () => {
    await messagingBridge.startPolling();
    expect(foregroundStartMock).toHaveBeenCalledWith(true);
  });

  it('re-polls promptly after a successful getUpdates instead of waiting a fixed multi-second tick', async () => {
    await messagingBridge.startPolling();

    // Let a few polls chain through. The old implementation ticked on a
    // fixed 3000ms setInterval regardless of how long the previous request
    // took; the new one reschedules as soon as the previous poll resolves.
    // With an instantly-resolving mock, several polls should chain through
    // in well under one old-style 3s tick.
    await vi.advanceTimersByTimeAsync(200);

    const getUpdateCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length;
    expect(getUpdateCalls).toBeGreaterThanOrEqual(3);
  });

  it('backs off for a few seconds after a poll error instead of hot-looping', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/getUpdates')) return Promise.reject(new Error('network down'));
      return Promise.resolve(jsonResponse({ ok: true, result: { username: 'gia_bot' } }));
    });

    await messagingBridge.startPolling();
    await vi.advanceTimersByTimeAsync(10);
    const callsRightAfterFailure = fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length;
    expect(callsRightAfterFailure).toBe(1);

    // Should not have retried yet just after the failure...
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length).toBe(1);

    // ...but should have retried by ~5s.
    await vi.advanceTimersByTimeAsync(4500);
    expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length).toBe(2);
  });

  it('stopPolling actually stops future polls', async () => {
    await messagingBridge.startPolling();
    await vi.advanceTimersByTimeAsync(10);
    messagingBridge.stopPolling();
    const callsAtStop = fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length;

    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('getUpdates')).length).toBe(callsAtStop);
  });
});
