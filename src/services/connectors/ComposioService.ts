import { Browser } from '@capacitor/browser';
import { getStoredCredential, useCredentialStore } from '../../store/useCredentialStore';
import credentialVault from '../CredentialVault';

/**
 * Composio managed-auth gateway.
 *
 * The user pastes ONE Composio API key (from https://app.composio.dev) and gets
 * access to hundreds of connectors (gmail, github, notion, slack, …). Composio
 * hosts the entire OAuth handshake server-side: when we call
 * POST /connected_accounts, Composio returns a redirectUrl that we simply open
 * in the (Capacitor) in-app browser. The OAuth callback lands on a
 * Composio-hosted redirect server, NOT on a gia:// deep-link — so the app does
 * not need any deep-link handler. We just poll
 * GET /connected_accounts/{id} every few seconds until the account flips to
 * ACTIVE (or FAILED / the timeout elapses).
 *
 * REST surface (verified against docs.composio.dev v3):
 *   Base     https://backend.composio.dev/api/v3   (header `x-api-key`)
 *   GET    /toolkits                        — catalog { slug, name, meta.logo, categories }
 *   POST   /connected_accounts              — { toolkitSlug } → { id, status: "INITIATED", redirectUrl }
 *   GET    /connected_accounts              — list, optional ?toolkit_slugs=<a,b>
 *   GET    /connected_accounts/{id}         — poll until ACTIVE
 *   DELETE /connected_accounts/{id}         — disconnect
 *   POST   /tools/execute/{tool_slug}       — { arguments, connectedAccountId, version: "latest" }
 *
 * Response shapes are read defensively (top-level OR nested under `data`,
 * snake_case OR camelCase) because Composio has shuffled these between
 * versions; raw error bodies are surfaced in ComposioError.body.
 */

export const COMPOSIO_SERVICE_ID = 'composio';

export const NO_KEY_MESSAGE =
  'Connect Composio first in Settings → Connections (paste your Composio API key).';

const BASE_URL = 'https://backend.composio.dev/api/v3';
const REQUEST_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 3000;
const DEFAULT_TRACK_TIMEOUT_MS = 120000;
const TOOLKIT_CAP = 500;
const MAX_TOOLKIT_PAGES = 5;

export class ComposioError extends Error {
  status?: number;
  body?: string;
  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'ComposioError';
    if (status !== undefined) this.status = status;
    if (body !== undefined) this.body = body;
  }
}

export interface ComposioToolkit {
  slug: string;
  name: string;
  logo?: string;
  categories?: string[];
}

export interface ComposioConnectInitiation {
  id: string;
  status: string;
  redirectUrl?: string;
}

export interface ComposioAccount {
  id: string;
  status: string;
  toolkitSlug?: string;
  createdAt?: number;
}

/** Human-facing phases of an OAuth track. */
export type ComposioTrackStatus = 'initiating' | 'waiting' | 'connected' | 'failed';

export interface ComposioTrackOptions {
  onStatus?: (status: ComposioTrackStatus, message?: string) => void;
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Defensive response-shape helpers
// ---------------------------------------------------------------------------

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Read the first non-empty value for `keys` from the object, falling back to a nested `data` object. */
function pickField(payload: unknown, keys: string[]): unknown {
  if (!payload || typeof payload !== 'object') return undefined;
  const rec = payload as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  if (rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data)) {
    const nested = rec.data as Record<string, unknown>;
    for (const key of keys) {
      const v = nested[key];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return undefined;
}

/** Extract the list of records from a list endpoint payload (array, {items}, {data}, one level deep). */
function extractItems(payload: unknown): Record<string, unknown>[] {
  const asRecords = (list: unknown[]): Record<string, unknown>[] =>
    list.filter(x => x && typeof x === 'object') as Record<string, unknown>[];
  if (Array.isArray(payload)) return asRecords(payload);
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'toolkits', 'accounts']) {
      if (Array.isArray(rec[key])) return asRecords(rec[key]);
      // One level of nesting: { data: { items: [...] } }
      if (rec[key] && typeof rec[key] === 'object') {
        const inner = rec[key] as Record<string, unknown>;
        for (const innerKey of ['items', 'data', 'results']) {
          if (Array.isArray(inner[innerKey])) return asRecords(inner[innerKey]);
        }
      }
    }
  }
  return [];
}

function normalizeAccount(payload: unknown): ComposioAccount {
  const createdAtRaw = pickField(payload, ['createdAt', 'created_at']);
  let createdAt: number | undefined;
  if (typeof createdAtRaw === 'number' && Number.isFinite(createdAtRaw)) {
    createdAt = createdAtRaw;
  } else if (typeof createdAtRaw === 'string') {
    const parsed = Date.parse(createdAtRaw);
    if (!Number.isNaN(parsed)) createdAt = parsed;
  }
  return {
    id: str(pickField(payload, ['id'])) || '',
    status: str(pickField(payload, ['status'])) || 'UNKNOWN',
    toolkitSlug: str(pickField(payload, ['toolkitSlug', 'toolkit_slug'])),
    createdAt,
  };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

class ComposioService {
  private listeners = new Set<() => void>();

  // ------------------------------------------------------------------ key

  hasKey(): boolean {
    return !!this.getKey();
  }

  getKey(): string | undefined {
    const fromStore = getStoredCredential(COMPOSIO_SERVICE_ID)?.value?.trim();
    if (fromStore) return fromStore;
    // The credential store write-through also caches in CredentialVault; on
    // native the vault (EncryptedSharedPreferences) can hold a fresher copy
    // than IndexedDB when a WebView was killed mid-write.
    return credentialVault.get(COMPOSIO_SERVICE_ID)?.value?.trim() || undefined;
  }

  setKey(key: string): void {
    const trimmed = key.trim();
    if (!trimmed) return;
    // setCredential persists to IndexedDB and write-throughs into the native
    // vault, so the key survives reloads and process kills.
    useCredentialStore.getState().setCredential({
      serviceId: COMPOSIO_SERVICE_ID,
      label: 'Composio',
      kind: 'api_key',
      value: trimmed,
    });
  }

  clearKey(): void {
    useCredentialStore.getState().removeCredential(COMPOSIO_SERVICE_ID);
  }

  /** Async recovery path: read the key straight from the native vault if the store copy is missing. */
  async getKeyAsync(): Promise<string | undefined> {
    const sync = this.getKey();
    if (sync) return sync;
    const native = await credentialVault.getNative(COMPOSIO_SERVICE_ID);
    return native?.trim() || undefined;
  }

  // --------------------------------------------------------------- request

  private async request<T = unknown>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'; body?: unknown; query?: Record<string, string> } = {},
  ): Promise<T> {
    const apiKey = this.getKey();
    if (!apiKey) throw new ComposioError(NO_KEY_MESSAGE);

    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers: {
          'x-api-key': apiKey,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      throw new ComposioError(`Composio request failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const rawBody = await res.text();
    if (!res.ok) {
      // Surface the raw error body — Composio puts actionable detail there
      // (invalid key, unknown toolkit, no OAuth config for the app, …).
      throw new ComposioError(
        `Composio API error (HTTP ${res.status}) for ${path}: ${rawBody.slice(0, 500)}`,
        res.status,
        rawBody,
      );
    }
    try {
      return JSON.parse(rawBody) as T;
    } catch {
      return rawBody as unknown as T;
    }
  }

  // -------------------------------------------------------------- catalog

  /**
   * Cheap live validation of the stored key against GET /toolkits?limit=1.
   * The UI must never claim "connected" for a key Composio actually rejects.
   */
  async verifyKey(): Promise<{ ok: boolean; status?: number; message?: string }> {
    try {
      await this.request('/toolkits', { query: { limit: '1' } });
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        status: e instanceof ComposioError ? e.status : undefined,
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getToolkits(query?: string): Promise<ComposioToolkit[]> {
    const all: ComposioToolkit[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOLKIT_PAGES && all.length < TOOLKIT_CAP; page++) {
      const payload = await this.request<unknown>('/toolkits', {
        query: { limit: String(TOOLKIT_CAP), ...(cursor ? { cursor } : {}) },
      });
      for (const item of extractItems(payload)) {
        if (all.length >= TOOLKIT_CAP) break;
        const slug = str(pickField(item, ['slug']));
        if (!slug) continue;
        const logo = str(pickField(item, ['logo'])) || undefined;
        const meta = item.meta as Record<string, unknown> | undefined;
        const categoriesRaw = item.categories;
        all.push({
          slug,
          name: str(pickField(item, ['name'])) || slug,
          logo: logo || str(meta?.logo) || undefined,
          categories: Array.isArray(categoriesRaw)
            ? categoriesRaw.filter(c => typeof c === 'string') as string[]
            : undefined,
        });
      }
      const next = str(pickField(payload, ['next_cursor', 'nextCursor']));
      if (!next || next === cursor) break;
      cursor = next;
    }

    const q = query?.trim().toLowerCase();
    if (!q) return all;
    return all.filter(t => t.slug.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  }

  // ------------------------------------------------------------ accounts

  async initiateConnect(slug: string): Promise<ComposioConnectInitiation> {
    const payload = await this.request<unknown>('/connected_accounts', {
      method: 'POST',
      body: { toolkitSlug: slug },
    });
    const id = str(pickField(payload, ['id']));
    if (!id) throw new ComposioError(`Composio did not return a connected account id for "${slug}".`);
    this._emitAccountsChanged();
    return {
      id,
      status: str(pickField(payload, ['status'])) || 'INITIATED',
      redirectUrl: str(pickField(payload, ['redirectUrl', 'redirect_url', 'authLink'])) || undefined,
    };
  }

  async getAccount(id: string): Promise<ComposioAccount> {
    const payload = await this.request<unknown>(`/connected_accounts/${encodeURIComponent(id)}`);
    const account = normalizeAccount(payload);
    if (!account.id) account.id = id;
    return account;
  }

  async listAccounts(toolkitSlugs?: string[]): Promise<ComposioAccount[]> {
    const query: Record<string, string> = {};
    if (toolkitSlugs && toolkitSlugs.length > 0) query.toolkit_slugs = toolkitSlugs.join(',');
    const payload = await this.request<unknown>('/connected_accounts', { query });
    return extractItems(payload)
      .map(normalizeAccount)
      .filter(a => !!a.id);
  }

  /** First ACTIVE account for a toolkit, or undefined. Used for tool-account auto-resolution. */
  async resolveActiveAccount(toolkitSlug: string): Promise<ComposioAccount | undefined> {
    const accounts = await this.listAccounts([toolkitSlug]);
    return accounts.find(a => a.status === 'ACTIVE');
  }

  async disconnect(id: string): Promise<void> {
    await this.request(`/connected_accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    this._emitAccountsChanged();
  }

  // --------------------------------------------------------- oauth track

  /**
   * Initiate + open the redirect URL in the Capacitor in-app browser + poll
   * until the account is ACTIVE. Composio hosts the OAuth redirect
   * server-side, so NO deep-link back into the app is needed — we simply poll.
   * Resolves with the ACTIVE account; rejects on FAILED or timeout.
   */
  async openAndTrack(slug: string, options: ComposioTrackOptions = {}): Promise<ComposioAccount> {
    options.onStatus?.('initiating', `Opening ${slug} OAuth…`);
    const init = await this.initiateConnect(slug);
    if (init.redirectUrl) {
      try {
        await Browser.open({ url: init.redirectUrl });
      } catch {
        // In-app browser unavailable (e.g. web/dev): keep polling — the user
        // may complete the flow in a system browser or the Composio dashboard.
      }
    }
    // If there is no redirectUrl, some toolkits use "managed" API-key auth that
    // Composio completes itself; server-side polling still applies.
    try {
      return await this.trackAccount(init.id, options);
    } finally {
      try {
        await Browser.close();
      } catch {
        /* nothing to close */
      }
    }
  }

  /**
   * Fire-and-forget variant of openAndTrack without a browser: initiate and
   * poll in the background. For brain tools that should not block the chat on
   * a human clicking "Allow" in an OAuth window.
   */
  connectInBackground(slug: string, options: ComposioTrackOptions = {}): Promise<ComposioAccount> {
    return this.initiateConnect(slug).then(init => this.trackAccount(init.id, options));
  }

  /** Poll GET /connected_accounts/{id} every 3s up to timeoutMs until ACTIVE/FAILED. */
  async trackAccount(id: string, options: ComposioTrackOptions = {}): Promise<ComposioAccount> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TRACK_TIMEOUT_MS;
    // Attempt-count based deadline: robust whether or not Date/time is mocked.
    const maxAttempts = Math.max(1, Math.ceil(timeoutMs / POLL_INTERVAL_MS));
    let lastRaw = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      let account: ComposioAccount;
      try {
        account = await this.getAccount(id);
      } catch {
        continue; // transient network/API hiccup — keep polling until the deadline
      }
      if (account.status !== lastRaw) {
        lastRaw = account.status;
        this._emitAccountsChanged();
      }
      if (account.status === 'ACTIVE') {
        options.onStatus?.('connected', account.toolkitSlug ? `${account.toolkitSlug} connected` : id);
        return account;
      }
      if (account.status === 'FAILED') {
        const msg = `Composio connection${account.toolkitSlug ? ` for "${account.toolkitSlug}"` : ` ${id}`} failed — run Connect again to retry.`;
        options.onStatus?.('failed', msg);
        throw new ComposioError(msg);
      }
      if (account.status !== 'INITIATED' && account.status !== 'PENDING') {
        // Unknown intermediate status — treat as still-waiting.
        options.onStatus?.('waiting', `Composio status: ${account.status}`);
      } else {
        options.onStatus?.('waiting', 'Waiting for OAuth to complete…');
      }
    }
    const msg = `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for the Composio connection (${id}) — check app.composio.dev → Connected Accounts.`;
    options.onStatus?.('failed', msg);
    throw new ComposioError(msg);
  }

  // ------------------------------------------------------------- execute

  async executeTool(toolSlug: string, args: Record<string, unknown>, connectedAccountId: string): Promise<unknown> {
    const payload = await this.request<unknown>(`/tools/execute/${encodeURIComponent(toolSlug)}`, {
      method: 'POST',
      body: { arguments: args ?? {}, connectedAccountId, version: 'latest' },
    });
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const inner = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};
    const successful = record.successful ?? inner.successful;
    if (successful === false) {
      const msg =
        str(record.error) ||
        str(inner.error) ||
        str(inner.message) ||
        str(record.message) ||
        `Composio tool "${toolSlug}" reported an unsuccessful execution.`;
      throw new ComposioError(msg);
    }
    return payload;
  }

  // ------------------------------------------------------------ subscribe

  onAccountsChanged(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private _emitAccountsChanged(): void {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch {
        /* a broken listener must never break polling */
      }
    }
  }
}

export default new ComposioService();
