import { useEffect, useState } from 'react';

/**
 * Forces a re-render on an interval while `active` is true. Used by live
 * delegation views so per-agent elapsed timers advance even when no store
 * update has arrived.
 */
export function useLiveTick(active: boolean, intervalMs = 400): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}
