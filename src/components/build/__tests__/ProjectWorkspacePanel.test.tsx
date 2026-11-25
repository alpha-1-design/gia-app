import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useGiaStore } from '../../../store/useGiaStore';
import { useCredentialStore } from '../../../store/useCredentialStore';

const { ensureAvailableMock, execMock, cloneMock, listMock, readFileMock } = vi.hoisted(() => ({
  ensureAvailableMock: vi.fn(),
  execMock: vi.fn(),
  cloneMock: vi.fn(),
  listMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('../../../services/SandboxService', () => ({
  PROJECTS_DIRECTORY: '/workspace/projects',
  default: {
    ensureAvailable: (...args: unknown[]) => ensureAvailableMock(...args),
    exec: (...args: unknown[]) => execMock(...args),
    clone: (...args: unknown[]) => cloneMock(...args),
    list: (...args: unknown[]) => listMock(...args),
    readFile: (...args: unknown[]) => readFileMock(...args),
  },
}));

const { default: ProjectWorkspacePanel } = await import('../ProjectWorkspacePanel');

const originalActiveProjectPath = useGiaStore.getState().activeProjectPath;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Route GitHub API calls to fixtures. Covers every endpoint the push flow
 *  touches: /user, /user/repos, ref resolution, blob uploads, tree build,
 *  commit creation, and the branch fast-forward. */
function mockGitHubApi(overrides: { calls?: { url: string; init?: RequestInit }[] } = {}) {
  const calls = overrides.calls ?? [];
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/user')) return jsonResponse({ login: 'octodemo' });
    if (url.includes('/user/repos')) {
      return jsonResponse([{
        id: 42,
        name: 'demo',
        full_name: 'octodemo/demo',
        description: 'Demo repository',
        html_url: 'https://github.com/octodemo/demo',
        clone_url: 'https://github.com/octodemo/demo.git',
        language: 'TypeScript',
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        topics: [],
        license: null,
        updated_at: '2026-01-01T00:00:00Z',
        archived: false,
        fork: false,
        private: false,
      }]);
    }
    if (url.includes('/git/ref/heads/main')) return jsonResponse({ ref: 'refs/heads/main', object: { sha: 'basesha' } });
    if (url.includes('/git/blobs')) return jsonResponse({ sha: 'blobsha-1' });
    if (url.includes('/git/trees')) return jsonResponse({ sha: 'treesha' });
    if (url.endsWith('/git/commits')) return jsonResponse({ sha: 'newsha', html_url: 'https://github.com/octodemo/demo/commit/newsha' });
    if (url.includes('/git/commits/')) return jsonResponse({ sha: 'basesha', tree: { sha: 'roottree' } });
    if (url.includes('/git/refs/heads/')) return jsonResponse({});
    return jsonResponse({});
  });
}

function fetchCalls(calls: { url: string; init?: RequestInit }[], matcher: (url: string) => boolean) {
  return calls.filter((call) => matcher(call.url));
}

describe('ProjectWorkspacePanel', () => {
  beforeEach(() => {
    ensureAvailableMock.mockReset().mockResolvedValue(true);
    execMock.mockReset().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    cloneMock.mockReset().mockResolvedValue({ stdout: 'Cloned', stderr: '', exitCode: 0 });
    listMock.mockReset().mockImplementation(async (path: string) => path === 'projects'
      ? [{ name: 'demo', isDir: true, size: 0, mode: 'drwxr-xr-x' }]
      : [{ name: 'App.tsx', isDir: false, size: 128, mode: '-rw-r--r--' }]);
    readFileMock.mockReset().mockResolvedValue('export default function App() {}');
    useGiaStore.setState({ activeProjectPath: null, projectMeta: {} });
    useCredentialStore.setState({ credentials: {} });
  });

  afterEach(() => {
    useGiaStore.setState({ activeProjectPath: originalActiveProjectPath, projectMeta: {} });
    useCredentialStore.setState({ credentials: {} });
    vi.restoreAllMocks();
  });

  it('clones into the project workspace and makes the repository active', async () => {
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: 'https://github.com/example/demo.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));

    await waitFor(() => {
      expect(cloneMock).toHaveBeenCalledWith('https://github.com/example/demo.git', undefined, undefined);
      expect(useGiaStore.getState().activeProjectPath).toBe('/workspace/projects/demo');
    });
    expect(await screen.findByText('Cloned demo into /workspace/projects/demo.')).toBeTruthy();
    // Opening a project must stamp its metadata (lastOpenedAt / updatedAt).
    const meta = useGiaStore.getState().projectMeta['/workspace/projects/demo'];
    expect(meta?.createdAt).toBeTypeOf('number');
    expect(meta?.lastOpenedAt).toBeTypeOf('number');
    expect(meta?.updatedAt).toBeTypeOf('number');
    expect(meta?.displayName).toBe('demo');
  });

  it('searches GitHub repositories and clones results with the saved token', async () => {
    listMock.mockImplementation(async (path: string) => path === 'projects'
      ? [{ name: 'private-demo', isDir: true, size: 0, mode: 'drwxr-xr-x' }]
      : []);
    useCredentialStore.getState().setCredential({
      serviceId: 'github',
      label: 'GitHub',
      kind: 'token',
      value: 'test-gh-token',
    });
    // Fresh Response per call: a Response body can only be read once, and the
    // panel now also calls getAuthenticatedUser on mount.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      items: [{
        id: 9,
        name: 'private-demo',
        full_name: 'example/private-demo',
        description: 'Private project',
        html_url: 'https://github.com/example/private-demo',
        clone_url: 'https://github.com/example/private-demo.git',
        language: 'TypeScript',
        stargazers_count: 1,
        forks_count: 0,
        open_issues_count: 0,
        topics: [],
        license: null,
        updated_at: '2026-01-01T00:00:00Z',
        archived: false,
        fork: false,
      }],
    }), { status: 200 }));
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Search GitHub repositories'), {
      target: { value: 'private demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Clone example/private-demo' }));
    await waitFor(() => {
      expect(cloneMock).toHaveBeenCalledWith(
        'https://github.com/example/private-demo.git',
        'private-demo',
        'test-gh-token',
      );
    });
  });

  it('shows selected repository files and previews text files', async () => {
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open project demo' }));
    fireEvent.click(await screen.findByRole('button', { name: /App\.tsx/ }));

    expect(await screen.findByText('export default function App() {}')).toBeTruthy();
    expect(readFileMock).toHaveBeenCalledWith('projects/demo/App.tsx');
  });

  it('routes to the token prompt when pushing without a GitHub token', async () => {
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Push to GitHub' }));
    expect(await screen.findByText('Connect a GitHub token to push')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub token' }));
    await waitFor(() => {
      const request = useGiaStore.getState().pendingApiKeyRequest;
      expect(request?.providerId).toBe('github');
      expect(request?.kind).toBe('token');
    });
  });

  it('pushes staged files to GitHub in one commit (blob → tree → commit → ref)', async () => {
    useCredentialStore.getState().setCredential({
      serviceId: 'github',
      label: 'GitHub',
      kind: 'token',
      value: 'secret-token',
    });
    useGiaStore.setState({ activeProjectPath: '/workspace/projects/demo' });
    const calls: { url: string; init?: RequestInit }[] = [];
    mockGitHubApi({ calls });
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Push to GitHub' }));

    // Repository dropdown is populated from listRepos and auto-selects.
    const select = (await screen.findByLabelText('Target repository')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('octodemo/demo'));

    // Stage the project and check the count+size preview.
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    expect(await screen.findByText(/Staged 1 files · 128 B/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Push 1 files to octodemo\/demo/ }));

    expect(await screen.findByText(/Pushed 1 files to octodemo\/demo@main — commit newsha/)).toBeTruthy();

    // Blob upload carries UTF-8-safe base64 of the staged file content.
    const blobCalls = fetchCalls(calls, (url) => url.includes('/git/blobs'));
    expect(blobCalls).toHaveLength(1);
    const blobBody = JSON.parse(String(blobCalls[0].init?.body));
    expect(blobBody.encoding).toBe('base64');
    expect(blobBody.content).toBe(btoa('export default function App() {}'));

    // Tree POST builds on the head commit's tree with the uploaded blob.
    const treeCalls = fetchCalls(calls, (url) => url.includes('/git/trees'));
    expect(treeCalls).toHaveLength(1);
    const treeBody = JSON.parse(String(treeCalls[0].init?.body));
    expect(treeBody.base_tree).toBe('roottree');
    expect(treeBody.tree).toEqual([{ path: 'App.tsx', mode: '100644', type: 'blob', sha: 'blobsha-1' }]);

    // Commit POST uses the auto message, the new tree, and the head parent.
    const commitCalls = fetchCalls(calls, (url) => url.endsWith('/git/commits'));
    expect(commitCalls).toHaveLength(1);
    const commitBody = JSON.parse(String(commitCalls[0].init?.body));
    expect(commitBody.message).toMatch(/^push from GIA Build Studio · \d{4}-\d{2}-\d{2}T/);
    expect(commitBody.tree).toBe('treesha');
    expect(commitBody.parents).toEqual(['basesha']);
    expect(commitBody.author?.name).toBeTruthy();
    expect(commitBody.author?.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(commitBody.committer?.email).toBeTruthy();

    // Branch ref is fast-forwarded to the new commit — never forced.
    const refCalls = fetchCalls(calls, (url) => url.includes('/git/refs/heads/'));
    expect(refCalls).toHaveLength(1);
    const refBody = JSON.parse(String(refCalls[0].init?.body));
    expect(refBody).toEqual({ sha: 'newsha', force: false });

    // A store notification carries the sha + repo URL, and the project's
    // updatedAt got bumped by the push.
    const notifications = useGiaStore.getState().notifications;
    expect(notifications.some((n) => n.message.includes('commit newsha') && n.message.includes('octodemo/demo'))).toBe(true);
    expect(useGiaStore.getState().projectMeta['/workspace/projects/demo']?.updatedAt).toBeGreaterThan(0);
  });

  it('creates a blank project with timestamps via the store meta', async () => {
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'New blank project' }));
    fireEvent.change(screen.getByLabelText('New project name'), { target: { value: 'fresh-app' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(execMock).toHaveBeenCalledWith("mkdir -p 'fresh-app'", { workdir: 'projects' });
      expect(useGiaStore.getState().activeProjectPath).toBe('/workspace/projects/fresh-app');
    });
    const meta = useGiaStore.getState().projectMeta['/workspace/projects/fresh-app'];
    expect(meta?.createdAt).toBeGreaterThan(0);
    expect(meta?.updatedAt).toBeGreaterThan(0);
    expect(meta?.lastOpenedAt).toBeGreaterThan(0);
    expect(await screen.findByText(/Created blank project fresh-app/)).toBeTruthy();
  });

  it('renames a project in the sandbox and swaps the metadata', async () => {
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename project demo' }));
    fireEvent.change(screen.getByLabelText('Renamed project name'), { target: { value: 'demo2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(execMock).toHaveBeenCalledWith("mv 'demo' 'demo2'", { workdir: 'projects' });
      expect(useGiaStore.getState().projectMeta['/workspace/projects/demo']).toBeUndefined();
      expect(useGiaStore.getState().projectMeta['/workspace/projects/demo2']?.displayName).toBe('demo2');
      expect(useGiaStore.getState().projectMeta['/workspace/projects/demo2']?.updatedAt).toBeGreaterThan(0);
    });
    expect(await screen.findByText('Renamed demo to demo2.')).toBeTruthy();
  });

  it('deletes a project after an explicit confirmation and clears the active path', async () => {
    useGiaStore.setState({ activeProjectPath: '/workspace/projects/demo' });
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete project demo' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(execMock).toHaveBeenCalledWith("rm -rf -- 'demo'", { workdir: 'projects' });
      expect(useGiaStore.getState().activeProjectPath).toBeNull();
      expect(useGiaStore.getState().projectMeta['/workspace/projects/demo']).toBeUndefined();
    });
    expect(await screen.findByText('Deleted demo.')).toBeTruthy();
  });

  it('clears activeProjectPath when the active project vanishes from listings', async () => {
    useGiaStore.setState({ activeProjectPath: '/workspace/projects/ghost' });
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    // loadProjects only finds "demo" — the ghost project is gone.
    await waitFor(() => {
      expect(useGiaStore.getState().activeProjectPath).toBeNull();
    });
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ProjectWorkspacePanel onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Connected as <login>" when the token resolves a user', async () => {
    useCredentialStore.getState().setCredential({
      serviceId: 'github',
      label: 'GitHub',
      kind: 'token',
      value: 'secret-token',
    });
    mockGitHubApi();
    render(<ProjectWorkspacePanel onClose={vi.fn()} />);

    expect(await screen.findByText('Connected as octodemo')).toBeTruthy();
  });
});
