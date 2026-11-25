/**
 * UnimindClient battery-pause tests.
 *
 * While the page is hidden the client must drop the relay socket, stop the
 * presence heartbeat and suppress the reconnect chain; on visible it must
 * reconnect and resume. (The old client kept the 1s→30s reconnect chain and
 * the 60s ping running while hidden.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState = 0;
  onopen: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  sent: string[] = [];
  close = vi.fn(() => {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  });

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

// Dynamic import so the stubbed WebSocket is in place first.
const { UnimindClient } = await import('../unimindClient');

describe('UnimindClient — battery pause while hidden', () => {
  let client: InstanceType<typeof UnimindClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    FakeWebSocket.instances = [];
    setVisibility('visible');
    client = new UnimindClient();
    client.setRelayUrl('ws://relay.test/unimind');
    void client.connect();
  });

  afterEach(() => {
    client.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('closes the socket and stops the ping when the page is hidden', () => {
    const ws = FakeWebSocket.instances[0];
    ws.readyState = 1;
    ws.onopen?.();

    // Presence heartbeat proves the socket session is live.
    vi.advanceTimersByTime(60_000);
    expect(ws.sent).toHaveLength(3);   // hello + online + 60s heartbeat

    // Exactly one timer (the heartbeat) is torn down on hidden — the jsdom
    // environment itself queues timers on localStorage writes, so assert the
    // delta instead of an absolute count.
    const timersBefore = vi.getTimerCount();
    setVisibility('hidden');

    expect(ws.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(timersBefore - 1);
  });

  it('suppresses the reconnect chain for the whole hidden period', () => {
    const ws = FakeWebSocket.instances[0];
    ws.readyState = 1;
    ws.onopen?.();

    setVisibility('hidden');

    // Old behavior: the 1s→30s reconnect chain kept firing new sockets.
    vi.advanceTimersByTime(5 * 60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('reconnects and resumes the heartbeat on visible', () => {
    const ws = FakeWebSocket.instances[0];
    ws.readyState = 1;
    ws.onopen?.();

    setVisibility('hidden');
    setVisibility('visible');

    // A fresh socket is opened for the resumed session.
    expect(FakeWebSocket.instances).toHaveLength(2);
    const resumed = FakeWebSocket.instances[1];
    resumed.readyState = 1;
    const timersBefore = vi.getTimerCount();
    resumed.onopen?.();

    // Presence heartbeat is back: exactly one timer (the 60s ping) started.
    expect(vi.getTimerCount()).toBe(timersBefore + 1);
    vi.advanceTimersByTime(60_000);
    expect(resumed.sent.some((m) => m.includes('"presence"'))).toBe(true);
  });
});
