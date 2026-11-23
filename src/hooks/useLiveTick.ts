import { useEffect, useState } from 'react';

/**
 * Forces a re-render on an interval while `active` is true. Used by live
 * delegation views so per-agent elapsed timers advance even when no store
 * update has arrived.
 *
 * Battery/perf contract: elapsed-time displays are second-granularity —
 * 400 ms re-rendered the whole subscribed tree 2.5×/s for nothing. Tick at
 * 1 Hz, and only while the app is visible (a hidden view re-rendering is
 * wasted CPU that Chrome can't even paint).
 */
export function useLiveTick(active: boolean, intervalMs = 1000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      setTick(t => t + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
