import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ComposioSection } from '../ComposioSection';
import { useCredentialStore } from '../../../store/useCredentialStore';
import credentialVault from '../../../services/CredentialVault';

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

// useGiaStore is a huge persisted store (and is being edited by other agents);
// the section only uses addNotification, so mock it to keep this test hermetic.
vi.mock('../../../store/useGiaStore', () => ({
  useGiaStore: {
    getState: () => ({ addNotification: vi.fn() }),
  },
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function mockComposioApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (url.includes('/toolkits')) {
      return Promise.resolve(jsonResponse({
        items: [
          { slug: 'gmail', name: 'Gmail', meta: { logo: '' } },
          { slug: 'github', name: 'GitHub' },
          { slug: 'notion', name: 'Notion' },
        ],
      }));
    }
    if (url.includes('/connected_accounts')) {
      // Nov 23 midday UTC — renders as "connected Nov 23" in every timezone ±11h.
      return Promise.resolve(jsonResponse({
        items: [
          { id: 'acc_gmail_1', status: 'ACTIVE', toolkitSlug: 'gmail', createdAt: Date.UTC(2026, 10, 23, 12) },
        ],
      }));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

beforeEach(async () => {
  useCredentialStore.setState({ credentials: {} });
  await credentialVault.remove('composio');
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCredentialStore.setState({ credentials: {} });
});

describe('ComposioSection', () => {
  it('shows the pitch copy, password key input and dashboard link when no key is saved', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<ComposioSection />);

    expect(screen.getByText(/One key unlocks hundreds of connectors\. Composio handles OAuth for you — no per-service API keys\./)).toBeDefined();

    const input = screen.getByPlaceholderText(/Paste your Composio API key/i) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.getAttribute('type')).toBe('password');

    const link = screen.getByRole('link', { name: /app\.composio\.dev\/settings/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://app.composio.dev/settings');

    // Key-less state must not hit the Composio API.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the toolkit catalog and connected accounts (status chip + human timestamp) when a key is saved', async () => {
    useCredentialStore.getState().setCredential({
      serviceId: 'composio',
      label: 'Composio',
      kind: 'api_key',
      value: 'ck_test_123',
    });
    const fetchMock = mockComposioApi();
    render(<ComposioSection />);

    // Catalog loads and renders toolkit entries with name + slug.
    await waitFor(() => {
      expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0);
    });
    expect(screen.getByPlaceholderText(/Search connectors/i)).toBeDefined();
    expect(screen.getAllByText('gmail').length).toBeGreaterThan(0);

    // Connections list: ACTIVE chip and a human "connected <Month D>" timestamp.
    await waitFor(() => {
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/^connected [A-Z][a-z]{2} \d{1,2}$/).length).toBeGreaterThan(0);
    expect(screen.getByTitle('Disconnect')).toBeDefined();

    expect(fetchMock).toHaveBeenCalled();
  });

  it('rejects an invalid key with a friendly error and never claims "connected"', async () => {
    const { fireEvent } = await import('@testing-library/react');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        error: { message: 'Invalid API key: gia**_000', code: 801, slug: 'APIKey_InvalidAPIKey', status: 401 },
      }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    ));
    render(<ComposioSection />);

    fireEvent.change(screen.getByPlaceholderText(/Paste your Composio API key/i), { target: { value: 'gia_bad_key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Chip must show the rejection, not "connected".
    await waitFor(() => {
      expect(screen.getByText('key rejected')).toBeDefined();
    });
    expect(screen.queryByText('connected')).toBeNull();
    // Friendly message instead of a raw JSON dump.
    expect(screen.getAllByText(/Invalid API key — get a fresh key at app\.composio\.dev\/settings/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/"slug":"APIKey_InvalidAPIKey"/)).toBeNull();
  });

  it('verifies a valid key before showing "connected"', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const fetchMock = mockComposioApi();
    render(<ComposioSection />);

    fireEvent.change(screen.getByPlaceholderText(/Paste your Composio API key/i), { target: { value: 'ck_live_valid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('connected')).toBeDefined();
    });
    // verifyKey() ping + catalog fetch both hit the API.
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/toolkits')).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Invalid API key/)).toBeNull();
  });
});
