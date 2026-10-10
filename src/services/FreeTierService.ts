/**
 * FreeTierService — client-side rate limiting for keyless free providers.
 *
 * GIA ships a keyless free provider (Pollinations) so a fresh install works
 * without pasting an API key. To keep that shared tier usable for everyone —
 * and to be a good citizen against an anonymous public endpoint — this caps
 * how often the app may call such providers per minute and per day, and backs
 * off for a while when the provider itself answers 429.
 *
 * Counters live in localStorage: synchronous (survives a WebView kill the way
 * the provider-config store needs) and cheap. They only ever gate providers
 * listed in LIMITS; every other provider is untouched.
 */
const STORAGE_KEY = 'gia:free-tier:v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

interface FreeTierConfig {
  /** Requests allowed per rolling minute. Must tolerate one agentic turn
   * (the tool loop issues several calls back-to-back). */
  perMinute: number;
  /** Requests allowed per rolling 24h on this device. */
  perDay: number;
  /** Cool-down after the provider itself returns 429. */
  cooldownMs: number;
}

const LIMITS: Record<string, FreeTierConfig> = {
  pollinations: { perMinute: 20, perDay: 500, cooldownMs: 60_000 },
};

interface FreeTierState {
  hits: Record<string, number[]>;
  cooldownUntil: Record<string, number>;
}

function read(): FreeTierState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hits: {}, cooldownUntil: {} };
    const parsed = JSON.parse(raw) as Partial<FreeTierState>;
    return { hits: parsed.hits ?? {}, cooldownUntil: parsed.cooldownUntil ?? {} };
  } catch {
    return { hits: {}, cooldownUntil: {} };
  }
}

function write(state: FreeTierState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — limiting degrades to off, never throws */
  }
}

function recent(hits: number[], now: number): number[] {
  return hits.filter((t) => now - t < DAY_MS);
}

export interface FreeTierDecision {
  allowed: boolean;
  reason?: string;
  retryAfterMs: number;
}

class FreeTierService {
  isFreeTier(providerId: string): boolean {
    return providerId in LIMITS;
  }

  /** Requests left in the rolling 24h window, or null for ungoverned providers. */
  remainingToday(providerId: string): number | null {
    const cfg = LIMITS[providerId];
    if (!cfg) return null;
    const hits = recent(read().hits[providerId] ?? [], Date.now());
    return Math.max(0, cfg.perDay - hits.length);
  }

  check(providerId: string): FreeTierDecision {
    const cfg = LIMITS[providerId];
    if (!cfg) return { allowed: true, retryAfterMs: 0 };
    const now = Date.now();
    const state = read();

    const cooldownUntil = state.cooldownUntil[providerId] ?? 0;
    if (cooldownUntil > now) {
      return { allowed: false, retryAfterMs: cooldownUntil - now, reason: 'the free model is briefly busy' };
    }

    const hits = recent(state.hits[providerId] ?? [], now);
    const lastMinute = hits.filter((t) => now - t < MINUTE_MS);
    if (lastMinute.length >= cfg.perMinute) {
      const oldest = Math.min(...lastMinute);
      return {
        allowed: false,
        retryAfterMs: Math.max(1000, MINUTE_MS - (now - oldest)),
        reason: 'the free tier is busy right now',
      };
    }
    if (hits.length >= cfg.perDay) {
      return { allowed: false, retryAfterMs: 0, reason: 'the daily free limit is reached' };
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Count one request attempt against the provider's free-tier budget. */
  record(providerId: string): void {
    if (!this.isFreeTier(providerId)) return;
    const now = Date.now();
    const state = read();
    const hits = recent(state.hits[providerId] ?? [], now);
    hits.push(now);
    state.hits[providerId] = hits;
    write(state);
  }

  /** Called when the provider answers 429 — pause before trying it again. */
  markRateLimited(providerId: string): void {
    const cfg = LIMITS[providerId];
    if (!cfg) return;
    const state = read();
    state.cooldownUntil[providerId] = Date.now() + cfg.cooldownMs;
    write(state);
  }
}

export const freeTier = new FreeTierService();
export default freeTier;
