import { logger } from '../../utils/logger';
import { useProviderStore } from '../../store/useProviderStore';
import ProviderMonitor from '../ProviderMonitor';
import { providerRegistry } from '../ProviderRegistry';

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

/** Invalid/expired/revoked key, or account not authorized for this model. Another
 * connected provider's key is unaffected, so this is a great fallback candidate. */
export function isAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('401') || m.includes('403') || m.includes('unauthorized') || m.includes('forbidden')
    || m.includes('invalid api key') || m.includes('invalid_api_key') || m.includes('incorrect api key')
    || m.includes('authentication') || m.includes('permission denied');
}

/** Fetch/connection failures -- transient, worth trying a different provider
 * immediately rather than assuming the whole device/network is offline. */
export function isNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('network') || m.includes('fetch failed') || m.includes('failed to fetch')
    || m.includes('econnrefused') || m.includes('econnreset') || m.includes('timeout')
    || m.includes('timed out') || m.includes('aborted') || m.includes('enotfound');
}

/** Model ID renamed, deprecated, or never existed on this provider. */
export function isModelNotFoundError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('404') || m.includes('model not found') || m.includes('does not exist')
    || m.includes('unknown model') || m.includes('invalid model');
}

/** Prompt (or accumulated history) exceeds this model's context window --
 * a different provider/model may have more headroom. */
export function isContextLengthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('context length') || m.includes('context_length') || m.includes('maximum context')
    || m.includes('too many tokens') || m.includes('context window');
}

/**
 * Almost any transport/provider-side failure is worth trying elsewhere for --
 * matching how OpenRouter treats "any error" as fallback-eligible (context
 * length, moderation, rate limits, downtime). The one thing intentionally
 * excluded is our own input guardrail rejections, which would fail identically
 * on every provider since the content itself is what's being rejected, not
 * the provider serving it.
 */
export function isRecoverableError(msg: string): boolean {
  return isRateLimitOrQuotaError(msg) || isRetryableServerError(msg) || isAuthError(msg)
    || isNetworkError(msg) || isModelNotFoundError(msg) || isContextLengthError(msg);
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

/** Number of providers the person has actually connected (enabled + credentialed). */
export function countConnectedProviders(): number {
  const { providers } = useProviderStore.getState();
  return Object.entries(providers).filter(([id, cfg]) => cfg.enabled && (id === 'local-llm' || cfg.apiKey)).length;
}

/**
 * Picks the healthiest untried model offered by the given provider (e.g. an
 * OpenCode Zen key unlocks several models — deepseek, nemotron, hy3, ...).
 * Used to fail over within a single connected provider instead of having
 * nowhere to go.
 */
export function pickFallbackModel(provider: string, currentModel: string, excludeModels: string[]): string | null {
  const known = providerRegistry.getModels(provider);
  const candidates = known
    .map(m => m.id)
    .filter(id => id !== currentModel && !excludeModels.includes(id));
  if (candidates.length === 0) return null;

  const scored = candidates.map(model => ({
    model,
    health: ProviderMonitor.getHealth(provider, model),
  }));
  scored.sort((a, b) => {
    const statusRank = (s: string) => (s === 'healthy' ? 0 : s === 'degraded' ? 1 : 2);
    return statusRank(a.health.status) - statusRank(b.health.status);
  });
  return scored[0]?.model ?? candidates[0];
}

/**
 * Single entry point for failover decisions: tries other models on the
 * SAME provider first — never jumps to a different provider. If the
 * current provider is rate-limited, it cycles through other models that
 * same key/provider offers before giving up.
 */
export function pickFallback(
  currentProvider: string,
  currentModel: string,
  _triedProviders: string[],
  triedModels: string[],
): { provider: string; model: string; sameProvider: boolean } | null {
  const fallbackModel = pickFallbackModel(currentProvider, currentModel, triedModels);
  if (fallbackModel) return { provider: currentProvider, model: fallbackModel, sameProvider: true };

  return null;
}

/**
 * Exponential backoff with a cap — used when NO fallback model is available
 * on the same provider and we have to wait out the rate limit rather than
 * lose the request. Starts gentle (1s) and ramps slowly.
 */
export function backoffDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(1.5, attempt), 45000); // caps at 45s
  const jitter = base * 0.15 * Math.random();
  return Math.round(base + jitter);
}
