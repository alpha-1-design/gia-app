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

describe('ProjectWorkspacePanel', () => {
  beforeEach(() => {
    ensureAvailableMock.mockReset().mockResolvedValue(true);
    execMock.mockReset().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    cloneMock.mockReset().mockResolvedValue({ stdout: 'Cloned', stderr: '', exitCode: 0 });
    listMock.mockReset().mockImplementation(async (path: string) => path === 'projects'
      ? [{ name: 'demo', isDir: true, size: 0, mode: 'drwxr-xr-x' }]
      : [{ name: 'App.tsx', isDir: false, size: 128, mode: '-rw-r--r--' }]);
    readFileMock.mockReset().mockResolvedValue('export default function App() {}');
    useGiaStore.setState({ activeProjectPath: null });
    useCredentialStore.setState({ credentials: {} });
  });

  afterEach(() => {
    useGiaStore.setState({ activeProjectPath: originalActiveProjectPath });
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
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

    fireEvent.click(await screen.findByRole('button', { name: /demo/ }));
    fireEvent.click(await screen.findByRole('button', { name: /App\.tsx/ }));

    expect(await screen.findByText('export default function App() {}')).toBeTruthy();
    expect(readFileMock).toHaveBeenCalledWith('projects/demo/App.tsx');
  });
});
