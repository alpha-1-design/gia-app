export async function retryFetch(url: string, options: RequestInit, retries = 1): Promise<Response> {
  const hasTimeout = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';
  const canCombine = typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function';

  const run = async (attempt: number): Promise<Response> => {
    try {
      let signal = options.signal;
      if (hasTimeout && !signal) {
        signal = AbortSignal.timeout(60000);
      } else if (hasTimeout && signal && canCombine) {
        signal = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
      }
      const res = await fetch(url, { ...options, signal });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        return run(attempt + 1);
      }
      return res;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      return run(attempt + 1);
    }
  };
  return run(0);
}

export function friendlyError(label: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network error') || msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('DNS')) {
    return `${label} can't be reached — your network may be blocking it. Try OpenRouter (works everywhere) in Settings → Engine Room.`;
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')) {
    return `${label} rejected your API key — check it in Settings → Engine Room.`;
  }
  if (msg.includes('402') || msg.includes('insufficient_quota') || msg.includes('quota')) {
    return `${label} — your account has run out of credits or quota. Top up or switch providers.`;
  }
  if (msg.includes('429') || msg.includes('rate') || msg.includes('Rate limit')) {
    return `${label} — too many requests. Wait a moment or switch providers.`;
  }
  if (msg.includes('503') || msg.includes('502') || msg.includes('500') || msg.includes('server error') || msg.includes('Service Unavailable')) {
    return `${label} is temporarily down (server error) — try again later or switch to OpenRouter.`;
  }
  if (msg.includes('empty response') || msg.includes('returned empty')) {
    return `${label} returned nothing — the model may have usage caps. Try a different model or provider.`;
  }
  return msg;
}
