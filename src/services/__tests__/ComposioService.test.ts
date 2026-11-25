import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Browser } from '@capacitor/browser';
import composioService, { ComposioError, NO_KEY_MESSAGE } from '../connectors/ComposioService';
import { useCredentialStore } from '../../store/useCredentialStore';
import credentialVault from '../CredentialVault';

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const BASE = 'https://backend.composio.dev/api/v3';

async function resetKeyState() {
  useCredentialStore.setState({ credentials: {} });
  // CredentialVault keeps an in-memory cache even on web — clear it too.
  await credentialVault.remove('composio');
}

beforeEach(async () => {
  await resetKeyState();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ComposioService key handling', () => {
  it('roundtrips the key through the credential store (survives via persist)', () => {
    expect(composioService.hasKey()).toBe(false);
    composioService.setKey('  ck_test_123  ');
    expect(composioService.hasKey()).toBe(true);
    expect(composioService.getKey()).toBe('ck_test_123');
    const record = useCredentialStore.getState().getCredential('composio');
    expect(record?.value).toBe('ck_test_123');
    expect(record?.serviceId).toBe('composio');
    composioService.clearKey();
    expect(composioService.hasKey()).toBe(false);
    expect(composioService.getKey()).toBeUndefined();
  });

  it('sends the x-api-key header on every request once a key is saved', async () => {
    composioService.setKey('ck_test_123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({ items: [] })));
    await composioService.listAccounts();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/connected_accounts`);
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('ck_test_123');
  });

  it('fails fast with a clear message (and no request) when no key is saved', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(composioService.listAccounts()).rejects.toThrow(NO_KEY_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ComposioService connected accounts', () => {
  it('initiates a connect and reads the redirect URL from the top-level shape', async () => {
    composioService.setKey('ck_test_123');
    const changed = vi.fn();
    const unsub = composioService.onAccountsChanged(changed);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({ id: 'acc_1', status: 'INITIATED', redirectUrl: 'https://redirect.composio.dev/gia' })));
    const init = await composioService.initiateConnect('github');
    expect(init).toEqual({ id: 'acc_1', status: 'INITIATED', redirectUrl: 'https://redirect.composio.dev/gia' });
    const [url, reqInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/connected_accounts`);
    expect(reqInit.method).toBe('POST');
    expect(JSON.parse(reqInit.body as string)).toEqual({ toolkitSlug: 'github' });

    // initiate emits an accounts-changed event
    expect(changed).toHaveBeenCalledTimes(1);

    // unsubscribe works: disconnect after unsubscribing does not notify again
    unsub();
    await composioService.disconnect('acc_1');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('reads id/redirect_url from a nested-data response shape (defensive fallback)', async () => {
    composioService.setKey('ck_test_123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ data: { id: 'acc_2', status: 'INITIATED', redirect_url: 'https://redirect.composio.dev/notion' } }),
    );
    const init = await composioService.initiateConnect('notion');
    expect(init.id).toBe('acc_2');
    expect(init.status).toBe('INITIATED');
    expect(init.redirectUrl).toBe('https://redirect.composio.dev/notion');
  });

  it('lists accounts filtered by toolkit slugs', async () => {
    composioService.setKey('ck_test_123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({ items: [{ id: 'acc_1', status: 'ACTIVE', toolkitSlug: 'gmail', createdAt: '2026-11-23T12:00:00Z' }] })));
    const accounts = await composioService.listAccounts(['gmail', 'github']);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: 'acc_1', status: 'ACTIVE', toolkitSlug: 'gmail' });
    expect(accounts[0].createdAt).toBe(Date.parse('2026-11-23T12:00:00Z'));
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('toolkit_slugs=gmail%2Cgithub');
  });
});

describe('ComposioService executeTool', () => {
  it('posts arguments + connectedAccountId + version=latest and resolves on success', async () => {
    composioService.setKey('ck_test_123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: { successful: true, data: { sent: true } } })));
    const result = (await composioService.executeTool('GMAIL_SEND_EMAIL', { to: 'a@b.c' }, 'acc_1')) as {
      data: { successful: boolean; data: { sent: boolean } };
    };
    expect(result.data.successful).toBe(true);
    expect(result.data.data.sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/tools/execute/GMAIL_SEND_EMAIL`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      arguments: { to: 'a@b.c' },
      connectedAccountId: 'acc_1',
      version: 'latest',
    });
  });

  it('throws when the tool reports successful=false', async () => {
    composioService.setKey('ck_test_123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ data: { successful: false, error: 'Insufficient permissions' } }),
    );
    await expect(composioService.executeTool('GMAIL_SEND_EMAIL', {}, 'acc_1'))
      .rejects.toThrow('Insufficient permissions');
  });

  it('surfaces HTTP status and raw error body in ComposioError on 401', async () => {
    composioService.setKey('ck_wrong');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ detail: 'Invalid API key' }, 401));
    const err = await composioService.executeTool('GMAIL_SEND_EMAIL', {}, 'acc_1').then(
      () => { throw new Error('expected rejection'); },
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ComposioError);
    const composioErr = err as ComposioError;
    expect(composioErr.status).toBe(401);
    expect(composioErr.body).toContain('Invalid API key');
    expect(composioErr.message).toContain('401');
  });
});

describe('ComposioService getToolkits', () => {
  it('fetches the catalog with a page cap and filters client-side', async () => {
    composioService.setKey('ck_test_123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse({
        items: [
          { slug: 'gmail', name: 'Gmail', meta: { logo: 'https://cdn/g.png' } },
          { slug: 'github', name: 'GitHub', categories: ['devtools'] },
        ],
      })));
    const all = await composioService.getToolkits();
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ slug: 'gmail', name: 'Gmail', logo: 'https://cdn/g.png', categories: undefined });
    expect(all[1]).toEqual({ slug: 'github', name: 'GitHub', logo: undefined, categories: ['devtools'] });

    const filtered = await composioService.getToolkits('GIT');
    expect(filtered.map(t => t.slug)).toEqual(['github']);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('limit=500');
  });
});

describe('ComposioService OAuth polling', () => {
  beforeEach(async () => {
    await resetKeyState();
    // clearAllMocks (not restoreAllMocks): module-mock vi.fn()s keep their call
    // history across tests unless explicitly cleared.
    vi.clearAllMocks();
    composioService.setKey('ck_test_123');
    vi.useFakeTimers();
    vi.mocked(Browser.open).mockResolvedValue(undefined);
    vi.mocked(Browser.close).mockResolvedValue(undefined);
  });

  it('initiates, opens the browser, and polls every 3s until ACTIVE', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 'acc_9', status: 'INITIATED', redirectUrl: 'https://redirect.composio.dev/github' }))
      .mockResolvedValue(jsonResponse({ id: 'acc_9', status: 'ACTIVE', toolkitSlug: 'github' }));
    const statuses: string[] = [];
    const promise = composioService.openAndTrack('github', { onStatus: s => statuses.push(s) });
    await vi.advanceTimersByTimeAsync(3500);
    const account = await promise;
    expect(account).toMatchObject({ id: 'acc_9', status: 'ACTIVE', toolkitSlug: 'github' });
    expect(statuses).toContain('connected');
    // Browser got the Composio-hosted redirect URL (no deep-link needed).
    expect(Browser.open).toHaveBeenCalledWith({ url: 'https://redirect.composio.dev/github' });
    // Second request is the status poll.
    const [pollUrl] = fetchMock.mock.calls[1] as [string];
    expect(pollUrl).toBe(`${BASE}/connected_accounts/acc_9`);
  });

  it('rejects with a clear message when the account flips to FAILED', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 'acc_9', status: 'INITIATED', redirectUrl: 'https://redirect.composio.dev/github' }))
      .mockResolvedValue(jsonResponse({ id: 'acc_9', status: 'FAILED' }));
    const promise = composioService.openAndTrack('github');
    promise.catch(() => { /* handled below via rejects matcher */ });
    await vi.advanceTimersByTimeAsync(3500);
    await expect(promise).rejects.toThrow(/failed/i);
  });

  it('rejects with a clear timeout message when polling never reaches ACTIVE', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 'acc_9', status: 'INITIATED', redirectUrl: 'https://redirect.composio.dev/github' }))
      .mockResolvedValue(jsonResponse({ id: 'acc_9', status: 'INITIATED' }));
    const promise = composioService.openAndTrack('github', { timeoutMs: 12000 });
    promise.catch(() => { /* handled below via rejects matcher */ });
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(3000);
    }
    await expect(promise).rejects.toThrow(/timed out/i);
  });

  it('connectInBackground resolves without opening a browser', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 'acc_7', status: 'INITIATED' }))
      .mockResolvedValue(jsonResponse({ id: 'acc_7', status: 'ACTIVE', toolkitSlug: 'slack' }));
    const promise = composioService.connectInBackground('slack');
    await vi.advanceTimersByTimeAsync(3500);
    const account = await promise;
    expect(account).toMatchObject({ id: 'acc_7', status: 'ACTIVE' });
    expect(Browser.open).not.toHaveBeenCalled();
  });
});
