/**
 * streamWatchdog.ts — idle-stall detection for XHR-based provider streaming.
 *
 * Why this exists: every provider adapter sets `xhr.timeout = 120000`, which is
 * an *overall* wall-clock deadline, not an idle one. It resets on nothing and
 * is only consulted by the browser at coarse intervals. Two failure modes fall
 * out of that:
 *
 *   1. A provider that goes quiet mid-answer (rate-limit backoff, proxy wedge,
 *      half-open TCP) keeps the request alive without sending anything, so the
 *      user stares at a frozen reply with no error and no timeout. `onprogress`
 *      only fires when bytes actually arrive, so a dribbling keep-alive stream
 *      never trips the deadline either.
 *   2. A legitimately long answer (a big analysis, a slow reasoning model) can
 *      exceed 120s of total time even while streaming perfectly well, and gets
 *      killed mid-sentence.
 *
 * A watchdog keyed on *time since the last byte* fixes both: it never fires
 * while data is flowing, regardless of total duration, and it fires promptly
 * when data stops.
 *
 * We deliberately track "no bytes yet" separately from "stalled mid-stream".
 * A cold provider can legitimately take a while to emit its first token
 * (especially a reasoning model emitting a long thinking block), and failing
 * that on a short idle budget would reject healthy requests.
 */

export interface StreamWatchdogOptions {
  /** Abort the underlying XHR when the idle budget is exceeded. */
  onStall: () => void;
  /**
   * Builds the error surfaced to the caller. Kept as a callback so the text
   * can be built lazily at stall time rather than on every request.
   */
  message: () => string;
  /**
   * Grace period before the FIRST byte arrives. Generous by default: a cold
   * start or a long thinking block is normal, and we don't want to kill those.
   */
  firstByteMs?: number;
  /**
   * Grace period between bytes once streaming has begun. This is the budget
   * that actually protects the user from a frozen UI, so it stays tight.
   */
  idleMs?: number;
}

export interface StreamWatchdog {
  /** Call whenever bytes arrive. Reschedules the idle check. */
  poke(): void;
  /** Stop the watchdog. Safe to call more than once. */
  stop(): void;
}

/** Time allowed for the very first byte of a response. */
export const FIRST_BYTE_TIMEOUT_MS = 60_000;
/** Time allowed between bytes once streaming has started. */
export const STREAM_IDLE_TIMEOUT_MS = 30_000;

/**
 * Watches an XHR stream and calls `onStall` when bytes stop arriving.
 *
 * Implemented as a self-rescheduling `setTimeout` rather than an interval, so
 * an active stream costs nothing between pokes and there's no timer left
 * running after the request settles.
 */
export function createStreamWatchdog(opts: StreamWatchdogOptions): StreamWatchdog {
  const {
    onStall,
    firstByteMs = FIRST_BYTE_TIMEOUT_MS,
    idleMs = STREAM_IDLE_TIMEOUT_MS,
  } = opts;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let sawByte = false;
  let stopped = false;

  const arm = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const budget = sawByte ? idleMs : firstByteMs;
    timer = setTimeout(() => {
      timer = null;
      if (stopped) return;
      onStall();
    }, budget);
  };

  arm();

  return {
    poke() {
      if (stopped) return;
      sawByte = true;
      arm();
    },
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
