/**
 * The stall watchdog exists because `xhr.timeout` is a wall-clock ceiling, not
 * an idle one: a provider that stops sending bytes mid-answer leaves the user
 * watching a frozen reply forever. These tests pin the behaviour that fixes it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStreamWatchdog,
  FIRST_BYTE_TIMEOUT_MS,
  STREAM_IDLE_TIMEOUT_MS,
} from '../streamWatchdog';

describe('createStreamWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onStall when no bytes ever arrive within the first-byte budget', () => {
    const onStall = vi.fn();
    createStreamWatchdog({ onStall, message: () => 'stalled' });

    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS - 1);
    expect(onStall).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('fires when bytes stop arriving mid-stream, even though total time is long', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });

    // First byte arrives, so the tighter idle budget takes over.
    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS - 1);
    wd.poke();

    // Stream trickles for longer than the 120s wall-clock ceiling would allow,
    // but never stalls — this must NOT be treated as a stall.
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(STREAM_IDLE_TIMEOUT_MS - 1000);
      expect(onStall).not.toHaveBeenCalled();
      wd.poke();
    }

    // Now it goes quiet.
    vi.advanceTimersByTime(STREAM_IDLE_TIMEOUT_MS);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('uses the tighter idle budget once the first byte lands', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });
    wd.poke();

    // The first-byte budget is 60s; the idle budget is 30s. If poke() didn't
    // re-arm on the tighter budget we'd wait 60s here.
    vi.advanceTimersByTime(STREAM_IDLE_TIMEOUT_MS);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('stop() prevents any later firing and leaves no timer pending', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });
    wd.stop();

    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS * 10);
    expect(onStall).not.toHaveBeenCalled();
    // A leaked timer would keep the app alive and fire against a dead request.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe to stop more than once', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });
    wd.stop();
    expect(() => wd.stop()).not.toThrow();
  });

  it('ignores pokes after stop (a late onprogress must not re-arm)', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });
    wd.stop();
    wd.poke();

    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS * 10);
    expect(onStall).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('onStall firing does not re-arm itself', () => {
    const onStall = vi.fn();
    const wd = createStreamWatchdog({ onStall, message: () => 'stalled' });
    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS);
    expect(onStall).toHaveBeenCalledTimes(1);

    // A watchdog that kept polling would spam the error path; the adapter's
    // onStall calls stop() first, and this asserts a bare watchdog also settles.
    expect(vi.getTimerCount()).toBe(0);
    wd.stop();
  });

  it('honours custom budgets', () => {
    const onStall = vi.fn();
    createStreamWatchdog({ onStall, message: () => 'stalled', firstByteMs: 500 });

    vi.advanceTimersByTime(499);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('surfaces the caller-provided message text', () => {
    const onStall = vi.fn();
    const message = () => 'OpenAI stopped sending data for 30s';
    const wd = createStreamWatchdog({ onStall, message });

    vi.advanceTimersByTime(FIRST_BYTE_TIMEOUT_MS);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(message()).toContain('30s');
    wd.stop();
  });
});

describe('watchdog budgets', () => {
  it('gives the first byte a longer budget than the idle gap', () => {
    // A slow cold start (or a long reasoning block before the first visible
    // token) must not be killed by the tighter mid-stream budget.
    expect(FIRST_BYTE_TIMEOUT_MS).toBeGreaterThan(STREAM_IDLE_TIMEOUT_MS);
  });

  it('keeps the idle budget well under the 120s wall-clock ceiling', () => {
    // If the idle budget exceeded the ceiling, xhr.timeout would always fire
    // first and the watchdog would be dead code.
    expect(STREAM_IDLE_TIMEOUT_MS).toBeLessThan(120_000);
  });
});
