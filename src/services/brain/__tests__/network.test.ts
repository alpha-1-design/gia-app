import { describe, it, expect } from 'vitest';
import { friendlyError } from '../network';
import { isRateLimitOrQuotaError, isRetryableServerError } from '../ResilientRelay';

// These tests guard the GiaBrain resilience path: errors are routed through
// friendlyError() in the providers, then classified by isRateLimit*/isRetryable*
// to decide whether to retry. If the friendly message drops the keywords those
// classifiers look for, the retry/checkpoint recovery silently never triggers.

describe('friendlyError → retry classification', () => {
  it('a 429 surfaces as a rate-limit error that triggers retry', () => {
    const msg = friendlyError('OpenAI', new Error('429 Too Many Requests'));
    expect(isRateLimitOrQuotaError(msg)).toBe(true);
  });

  it('a quota error surfaces as a rate-limit/quota error', () => {
    const msg = friendlyError('OpenAI', new Error('insufficient_quota'));
    expect(isRateLimitOrQuotaError(msg)).toBe(true);
  });

  it('a 500/503 server error surfaces as a retryable server error', () => {
    const msg = friendlyError('OpenAI', new Error('500 Internal Server Error'));
    expect(isRetryableServerError(msg)).toBe(true);
    const msg503 = friendlyError('OpenAI', new Error('503 Service Unavailable'));
    expect(isRetryableServerError(msg503)).toBe(true);
  });

  it('a 401 auth error is NOT classified as retryable', () => {
    const msg = friendlyError('OpenAI', new Error('401 Unauthorized'));
    expect(isRateLimitOrQuotaError(msg)).toBe(false);
    expect(isRetryableServerError(msg)).toBe(false);
  });

  it('a network failure is NOT classified as retryable (it is retried via CORS proxy elsewhere)', () => {
    const msg = friendlyError('OpenAI', new Error('Failed to fetch'));
    expect(isRateLimitOrQuotaError(msg)).toBe(false);
    expect(isRetryableServerError(msg)).toBe(false);
  });

  it('a 400 with "rate" in the body is NOT classified as rate-limited when status code is provided', () => {
    const msg = friendlyError('OpenCode Zen', new Error('rate limit exceeded for this model'), 400);
    expect(isRateLimitOrQuotaError(msg)).toBe(false);
    expect(isRetryableServerError(msg)).toBe(false);
  });

  it('a real 429 IS classified as rate-limited when status code is provided', () => {
    const msg = friendlyError('OpenCode Zen', new Error('rate_limit_exceeded'), 429);
    expect(isRateLimitOrQuotaError(msg)).toBe(true);
  });

  it('a 5xx with body text is classified as server error via status code', () => {
    const msg = friendlyError('Gemini', new Error('some internal message'), 503);
    expect(isRetryableServerError(msg)).toBe(true);
  });
});
