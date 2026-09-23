import { beforeEach, describe, expect, it, vi } from 'vitest';
import credentialStore from '../../store/useCredentialStore';
import githubService from '../GitHubService';

describe('GitHubService authentication', () => {
  beforeEach(() => {
    credentialStore.setState({ credentials: {} });
    vi.restoreAllMocks();
  });

  it('uses the saved token for the authenticated user endpoint', async () => {
    credentialStore.getState().setCredential({
      serviceId: 'github',
      label: 'GitHub',
      kind: 'token',
      value: 'secret-token',
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ login: 'alpha-1-design' }), { status: 200 }),
    );

    await githubService.getUser('me');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user',
      { headers: { Authorization: 'Bearer secret-token', Accept: 'application/vnd.github+json' } },
    );
  });

  it('uses the public endpoint without a token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }),
    );

    await githubService.getUser('octocat');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/users/octocat',
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  });
});
