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

  it('searches public and accessible private repositories with the saved token', async () => {
    credentialStore.getState().setCredential({
      serviceId: 'github',
      label: 'GitHub',
      kind: 'token',
      value: 'secret-token',
    });
    const repo = { id: 1, full_name: 'owner/project' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [repo] }), { status: 200 }),
    );

    await expect(githubService.searchRepositories('project')).resolves.toEqual([repo]);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/search/repositories?q=project&per_page=10&sort=updated');
    const headers = options.headers as Record<string, string>;
    expect(headers).toHaveProperty('Authorization');
    expect(typeof headers.Authorization).toBe('string');
    expect(headers.Authorization.length).toBeGreaterThan(0);
    expect(headers).toHaveProperty('Accept', 'application/vnd.github+json');
  });
});
