const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'igshid', 'ref', 'ref_src', 'referrer',
  '_ga', '_gid', '_gcl_au', 'mc_cid', 'mc_eid', 'sr_share', 'share',
  'smid', 'sfns', 'ttclid', 'li_fat_id', 'cmpid', 'emcid', 'cta'
]);

const BLOCKED_DOMAINS = new Set([
  'accounts.google.com', 'login.microsoftonline.com', 'auth.',
  'consent.', 'cookie.', 'privacy.', 'terms.', 'signup.', 'register.',
  'paywall.', 'subscribe.', 'checkout.', 'cart.', 'billing.',
]);

const BLOCKED_PATHS = [
  '/login', '/signup', '/register', '/auth', '/consent', '/cookie',
  '/privacy', '/terms', '/paywall', '/subscribe', '/checkout', '/cart',
  '/billing', '/account', '/profile', '/settings', '/password',
];

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const params = new URLSearchParams(u.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key);
    }
    u.search = params.toString();
    return u.toString();
  } catch {
    return url;
  }
}

function isBlocked(url: string): boolean {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.has(hostname)) return true;
    for (const d of BLOCKED_DOMAINS) if (hostname.endsWith('.' + d) || hostname === d) return true;
    const path = u.pathname.toLowerCase();
    for (const bp of BLOCKED_PATHS) if (path.startsWith(bp)) return true;
    return false;
  } catch {
    return true;
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '').toLowerCase(); }
  catch { return ''; }
}

export interface SourceMeta {
  url: string;
  title?: string;
  snippet?: string;
  source?: string;
  normalizedUrl: string;
  domain: string;
}

export function validateAndDeduplicateSources(
  sources: (string | { url: string; title?: string; snippet?: string; source?: string })[],
  maxResults = 7
): SourceMeta[] {
  const seen = new Set<string>();
  const domainCounts = new Map<string, number>();
  const results: SourceMeta[] = [];

  for (const s of sources) {
    if (results.length >= maxResults) break;

    const url = typeof s === 'string' ? s : s.url;
    const title = typeof s === 'string' ? '' : (s.title || '');
    const snippet = typeof s === 'string' ? '' : (s.snippet || '');
    const src = typeof s === 'string' ? '' : (s.source || '');

    if (!url || typeof url !== 'string') continue;

    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) continue;
    if (isBlocked(normalized)) continue;

    const domain = extractDomain(normalized);
    if (!domain) continue;

    const count = domainCounts.get(domain) || 0;
    if (count >= 2) continue;

    seen.add(normalized);
    domainCounts.set(domain, count + 1);
    results.push({ url: normalized, title, snippet, source: src, normalizedUrl: normalized, domain });
  }

  return results;
}

export function compareSourcesFast(
  sourcesA: string[],
  sourcesB: string[]
): { shared: string[]; uniqueA: string[]; uniqueB: string[] } {
  const setA = new Set(sourcesA.map(normalizeUrl));
  const setB = new Set(sourcesB.map(normalizeUrl));
  const shared: string[] = [];
  const uniqueA: string[] = [];
  const uniqueB: string[] = [];

  for (const url of setA) {
    if (setB.has(url)) shared.push(url);
    else uniqueA.push(url);
  }
  for (const url of setB) if (!setA.has(url)) uniqueB.push(url);

  return { shared, uniqueA, uniqueB };
}