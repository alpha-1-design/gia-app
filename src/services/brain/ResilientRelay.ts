import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import ProviderMonitor from '../ProviderMonitor';

export interface GenerationCheckpoint {
  key: string;
  sessionId?: string;
  messageId?: string;
  originalPrompt: string;
  accumulatedText: string;
  history: { role: string; content: string }[];
  failedProvider: string;
  failedModel: string;
  reason: string;
  attempt: number;
  savedAt: number;
}

const STORAGE_PREFIX = 'gia-checkpoint:';
const MAX_CHECKPOINT_AGE_MS = 24 * 60 * 60 * 1000; // 24h — stale checkpoints aren't worth resuming

/** Durable, synchronous — survives a tab close/reload/crash, unlike in-memory state. */
export function saveCheckpoint(cp: GenerationCheckpoint): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + cp.key, JSON.stringify(cp));
  } catch (e) {
    logger.warn('[ResilientRelay] Failed to save checkpoint:', e);
  }
}

export function loadCheckpoint(key: string): GenerationCheckpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const cp = JSON.parse(raw) as GenerationCheckpoint;
    if (Date.now() - cp.savedAt > MAX_CHECKPOINT_AGE_MS) {
      clearCheckpoint(key);
      return null;
    }
    return cp;
  } catch {
    return null;
  }
}

export function clearCheckpoint(key: string): void {
  try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* noop */ }
}

export function listCheckpoints(): GenerationCheckpoint[] {
  const out: GenerationCheckpoint[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(STORAGE_PREFIX)) continue;
      const cp = loadCheckpoint(k.slice(STORAGE_PREFIX.length));
      if (cp) out.push(cp);
    }
  } catch { /* noop */ }
  return out;
}

export function isRateLimitOrQuotaError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('429') || m.includes('rate limit') || m.includes('rate_limit')
    || m.includes('quota') || m.includes('insufficient_quota') || m.includes('too many requests');
}

export function isRetryableServerError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')
    || m.includes('server error') || m.includes('service unavailable') || m.includes('overloaded');
}

/** Picks the healthiest enabled, credentialed provider other than the ones already tried. */
export function pickFallbackProvider(exclude: string[]): { provider: string; model: string } | null {
  const { providers } = useProviderStore.getState();
  const candidates = Object.entries(providers)
    .filter(([id, cfg]) => !exclude.includes(id) && cfg.enabled && (id === 'local-llm' || cfg.apiKey))
    .map(([id, cfg]) => ({ provider: id, model: cfg.model }));
  if (candidates.length === 0) return null;
  return ProviderMonitor.getBestProvider(candidates) || candidates[0];
}

/**
 * Exponential backoff with a cap — used when NO fallback provider is available
 * and we have to wait out the current one's rate limit rather than lose the request.
 */
export function backoffDelay(attempt: number): number {
  const base = Math.min(2000 * Math.pow(1.8, attempt), 60000); // caps at 60s
  const jitter = base * 0.2 * Math.random();
  return Math.round(base + jitter);
}
