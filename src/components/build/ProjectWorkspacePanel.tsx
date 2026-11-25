import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronRight, FileCode2, FileText, Folder, FolderGit2, GitBranch, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import SandboxService, { PROJECTS_DIRECTORY, type SandboxFileEntry } from '../../services/SandboxService';
import GitHubService, { type GitHubRepo } from '../../services/GitHubService';
import { useGiaStore } from '../../store/useGiaStore';
import { useCredentialStore } from '../../store/useCredentialStore';

interface ProjectWorkspacePanelProps {
  onClose: () => void;
}

const TEXT_EXTENSIONS = new Set([
  'c', 'cc', 'cpp', 'css', 'csv', 'env', 'go', 'h', 'hpp', 'html', 'ini', 'java',
  'js', 'jsx', 'json', 'log', 'md', 'mjs', 'py', 'rs', 'sh', 'sql', 'svg', 'toml',
  'ts', 'tsx', 'txt', 'xml', 'yaml', 'yml',
]);

/** Folders never staged for a GitHub push or packaged into a ZIP. */
const PUSH_EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__']);
/** Staging caps — pushing a dependency tree or build output to GitHub would
 *  take forever and blow the git data API's practical limits. */
const MAX_PUSH_FILES = 500;
const MAX_PUSH_BYTES = 10 * 1024 * 1024;

interface StagedFile {
  path: string;
  content: string;
}

function repoFolderName(repo: string): string {
  return repo.replace(/\/+$/, '').split(/[/:]/).pop()?.replace(/\.git$/i, '') || '';
}

function canPreview(entry: SandboxFileEntry): boolean {
  return !entry.isDir && TEXT_EXTENSIONS.has(entry.name.split('.').pop()?.toLowerCase() || '');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Compact relative timestamp for the project list ("2h ago"). */
function relativeTime(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function autoCommitMessage(): string {
  return `push from GIA Build Studio · ${new Date().toISOString()}`;
}

const ProjectWorkspacePanel: React.FC<ProjectWorkspacePanelProps> = ({ onClose }) => {
  const activeProjectPath = useGiaStore((state) => state.activeProjectPath);
  const hasGitHubToken = useCredentialStore((state) => Boolean(state.credentials.github?.value));
  const [projects, setProjects] = useState<SandboxFileEntry[]>([]);
  const [entries, setEntries] = useState<SandboxFileEntry[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [folderName, setFolderName] = useState('');
  const [repoQuery, setRepoQuery] = useState('');
  const [githubRepos, setGitHubRepos] = useState<GitHubRepo[]>([]);
  const [searchingRepos, setSearchingRepos] = useState(false);
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // "Connected as <login>" — resolved once per panel open from /user.
  const [gitLogin, setGitLogin] = useState('');

  // Project management (create blank / rename / delete with confirm).
  const [mgmt, setMgmt] = useState<{ mode: 'create' | 'rename'; original?: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Push-to-GitHub flow.
  const [pushView, setPushView] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [newRepoOpen, setNewRepoOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState(autoCommitMessage());
  const [staged, setStaged] = useState<{ count: number; bytes: number } | null>(null);
  const [pushStep, setPushStep] = useState('');
  const [pushing, setPushing] = useState(false);

  // Panel-level focus management (Escape to close + Tab focus trap).
  const panelRef = useRef<HTMLElement | null>(null);
  // Anti-double-load guard: loadDirectory records the directory it loaded so
  // the activeProject effect below never re-loads a directory that is already
  // on screen (openProject loads it eagerly; the effect used to load it a
  // second time on top, twice per project open).
  const lastLoadedDirRef = useRef<string>('');

  const activeName = useMemo(() => activeProjectPath?.split('/').filter(Boolean).pop() || '', [activeProjectPath]);
  const projectMeta = useGiaStore((state) => state.projectMeta);

  useEffect(() => {
    if (!hasGitHubToken) return;
    let cancelled = false;
    GitHubService.getAuthenticatedUser()
      .then((user) => { if (!cancelled) setGitLogin(user.login || ''); })
      .catch(() => { if (!cancelled) setGitLogin(''); });
    return () => { cancelled = true; };
  }, [hasGitHubToken]);

  // Escape closes the panel; Tab cycles focus inside the dialog only.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(
      panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !(active instanceof HTMLElement) || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !(active instanceof HTMLElement) || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!await SandboxService.ensureAvailable()) {
        throw new Error('The sandbox is not available yet. Set up the terminal in Settings, then try again.');
      }
      const setup = await SandboxService.exec(`mkdir -p ${PROJECTS_DIRECTORY}`);
      if (setup.exitCode !== 0) throw new Error(setup.stderr || setup.stdout || 'Could not prepare the project workspace.');
      const result = await SandboxService.list('projects');
      const dirs = result.filter((entry) => entry.isDir && entry.name !== '.' && entry.name !== '..');
      setProjects(dirs.sort((a, b) => a.name.localeCompare(b.name)));
      // If the active project's folder vanished from the workspace listing
      // (deleted on-device, wiped sandbox), stop pointing at a ghost path.
      const state = useGiaStore.getState();
      if (state.activeProjectPath) {
        const folder = state.activeProjectPath.split('/').filter(Boolean).pop() || '';
        if (!dirs.some((entry) => entry.name === folder)) {
          state.setActiveProjectPath(null);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await SandboxService.list(path);
      setEntries(result.filter((entry) => entry.name !== '.' && entry.name !== '..').sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      setCurrentDirectory(path);
      lastLoadedDirRef.current = path;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const openProject = useCallback(async (name: string) => {
    const path = `${PROJECTS_DIRECTORY}/${name}`;
    // One store call stamps lastOpenedAt/updatedAt AND makes it the active
    // Build workspace path.
    useGiaStore.getState().openProject(path);
    setPreview(null);
    setNotice(`${name} is now GIA's active project.`);
    await loadDirectory(`projects/${name}`);
  }, [loadDirectory]);

  useEffect(() => {
    if (!activeName) return;
    if (!projects.some((project) => project.name === activeName)) return;
    // Skip the load when this exact directory is already on screen —
    // openProject already loaded it (see lastLoadedDirRef above).
    if (lastLoadedDirRef.current === `projects/${activeName}`) return;
    void loadDirectory(`projects/${activeName}`);
  }, [activeName, loadDirectory, projects]);

  const cloneIntoWorkspace = async (repo: string, dest?: string) => {
    if (!await SandboxService.ensureAvailable()) {
      throw new Error('The sandbox is not available yet. Set up the terminal in Settings, then try again.');
    }
    const result = await SandboxService.clone(repo, dest, useCredentialStore.getState().getCredential('github')?.value);
    if (result.exitCode !== 0) {
      const detail = result.stderr || result.stdout || `Git clone failed (exit ${result.exitCode}).`;
      throw new Error(hasGitHubToken ? detail : `${detail}${repo.includes('github.com') ? ' If this is a private GitHub repository, connect a GitHub token and retry.' : ''}`);
    }
    const name = dest || repoFolderName(repo);
    if (!name) throw new Error('The repository cloned, but its folder name could not be determined.');
    await loadProjects();
    await openProject(name);
    setNotice(`Cloned ${name} into ${PROJECTS_DIRECTORY}/${name}.`);
  };

  const cloneRepository = async (event: React.FormEvent) => {
    event.preventDefault();
    const repo = repoUrl.trim();
    const dest = folderName.trim();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!repo) throw new Error('Enter a repository HTTPS or SSH URL.');
      if (dest && !/^[A-Za-z0-9_.-]+$/.test(dest)) {
        throw new Error('Use only letters, numbers, dots, dashes, and underscores for the folder name.');
      }
      await cloneIntoWorkspace(repo, dest || undefined);
      setRepoUrl('');
      setFolderName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const searchGitHub = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchingRepos(true);
    setError('');
    setGitHubRepos([]);
    try {
      setGitHubRepos(await GitHubService.searchRepositories(repoQuery));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSearchingRepos(false);
    }
  };

  const connectGitHub = () => {
    useGiaStore.getState().setPendingApiKeyRequest({
      providerId: 'github',
      label: 'GitHub',
      kind: 'token',
      description: 'Add a GitHub fine-grained personal access token with repository contents read AND write access. It is stored locally and used for GitHub discovery, cloning, and pushing Build Studio projects.',
    });
  };

  const cloneDiscoveredRepo = async (repo: GitHubRepo) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await cloneIntoWorkspace(repo.clone_url || repo.html_url, repo.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const openEntry = async (entry: SandboxFileEntry) => {
    const path = `${currentDirectory}/${entry.name}`;
    if (entry.isDir) {
      setPreview(null);
      await loadDirectory(path);
      return;
    }
    if (!canPreview(entry)) {
      setPreview({ path, content: 'This file type is not shown in the text preview. GIA can still work with it using project tools.' });
      return;
    }
    if (entry.size > 512 * 1024) {
      setPreview({ path, content: 'This file is larger than the 512 KB in-app preview limit.' });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const content = await SandboxService.readFile(path);
      setPreview({ path, content: content.slice(0, 100_000) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {
    if (!currentDirectory) return;
    const parent = currentDirectory.split('/').slice(0, -1).join('/');
    if (parent === 'projects') {
      setCurrentDirectory('');
      setEntries([]);
      setPreview(null);
      return;
    }
    void loadDirectory(parent);
  };

  const confirmMgmt = async () => {
    if (!mgmt) return;
    const raw = mgmt.value.trim();
    setError('');
    if (!raw) {
      setError('Enter a project folder name.');
      return;
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(raw) || raw === '.' || raw === '..') {
      setError('Use only letters, numbers, dots, dashes, and underscores for the folder name.');
      return;
    }
    setBusy(true);
    try {
      if (mgmt.mode === 'create') {
        const path = `${PROJECTS_DIRECTORY}/${raw}`;
        const result = await SandboxService.exec(`mkdir -p '${raw.replace(/'/g, `'\\''`)}'`, { workdir: 'projects' });
        if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || 'Could not create the project folder.');
        await loadProjects();
        await openProject(raw);
        setNotice(`Created blank project ${raw} at ${path}.`);
      } else if (mgmt.mode === 'rename' && mgmt.original) {
        if (raw === mgmt.original) {
          setMgmt(null);
          return;
        }
        const result = await SandboxService.exec(
          `mv '${mgmt.original.replace(/'/g, `'\\''`)}' '${raw.replace(/'/g, `'\\''`)}'`,
          { workdir: 'projects' },
        );
        if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || 'Could not rename the project folder.');
        // Meta swap: the old path's metadata is dropped, the new path gets
        // fresh timestamps (and becomes the active project under its new name).
        const oldPath = `${PROJECTS_DIRECTORY}/${mgmt.original}`;
        const newPath = `${PROJECTS_DIRECTORY}/${raw}`;
        useGiaStore.getState().removeProject(oldPath);
        if (activeProjectPath === oldPath) {
          await openProject(raw);
        } else {
          useGiaStore.getState().touchProject(newPath, { displayName: raw });
        }
        await loadProjects();
        if (currentDirectory.startsWith(`projects/${mgmt.original}`)) {
          await loadDirectory(currentDirectory.replace(`projects/${mgmt.original}`, `projects/${raw}`));
        }
        setNotice(`Renamed ${mgmt.original} to ${raw}.`);
      }
      setMgmt(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (name: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await SandboxService.exec(`rm -rf -- '${name.replace(/'/g, `'\\''`)}'`, { workdir: 'projects' });
      if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || 'Could not delete the project folder.');
      useGiaStore.getState().removeProject(`${PROJECTS_DIRECTORY}/${name}`);
      await loadProjects();
      if (currentDirectory.startsWith(`projects/${name}/`) || currentDirectory === `projects/${name}`) {
        setCurrentDirectory('');
        setEntries([]);
        setPreview(null);
        lastLoadedDirRef.current = '';
      }
      setNotice(`Deleted ${name}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  // --- Push to GitHub -----------------------------------------------------

  const openPushView = async () => {
    setPushView(true);
    setError('');
    setNotice('');
    setStaged(null);
    setCommitMessage(autoCommitMessage());
    if (!hasGitHubToken) return;
    setReposLoading(true);
    try {
      const list = await GitHubService.listRepos('me');
      setRepos(list);
      if (list.length > 0 && !selectedRepo) setSelectedRepo(list[0].full_name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setReposLoading(false);
    }
  };

  /** Recursively stage the active project for a push, excluding generated
   *  folders, with hard caps so a dependency tree can't stall the flow. */
  const stageProject = async (root: string): Promise<{ files: StagedFile[]; bytes: number }> => {
    const files: StagedFile[] = [];
    let bytes = 0;
    const walk = async (dir: string, prefix: string): Promise<void> => {
      const entriesInDir = await SandboxService.list(dir);
      for (const entry of entriesInDir) {
        if (entry.isDir) {
          if (PUSH_EXCLUDED_DIRS.has(entry.name)) continue;
          await walk(`${dir}/${entry.name}`, prefix ? `${prefix}/${entry.name}` : entry.name);
          if (files.length > MAX_PUSH_FILES) {
            throw new Error(`Staging stopped at ${MAX_PUSH_FILES} files — this project looks like it includes generated output. Exclude dist/build folders and push again.`);
          }
          continue;
        }
        if (files.length >= MAX_PUSH_FILES) {
          throw new Error(`Staging stopped at ${MAX_PUSH_FILES} files — this project looks like it includes generated output. Exclude dist/build folders and push again.`);
        }
        bytes += entry.size || 0;
        if (bytes > MAX_PUSH_BYTES) {
          throw new Error(`Staging stopped at the ${formatBytes(MAX_PUSH_BYTES)} limit — large assets should live in Git LFS or a release, not this push.`);
        }
        const content = await SandboxService.readFile(`${dir}/${entry.name}`);
        files.push({ path: prefix ? `${prefix}/${entry.name}` : entry.name, content });
      }
    };
    await walk(root, '');
    return { files, bytes };
  };

  const stageForPush = async () => {
    if (!activeProjectPath) return;
    setPushStep('Scanning project files…');
    setError('');
    try {
      const { files, bytes } = await stageProject(activeProjectPath);
      setStaged({ count: files.length, bytes });
      setPushStep('');
    } catch (cause) {
      setStaged(null);
      setError(cause instanceof Error ? cause.message : String(cause));
      setPushStep('');
    }
  };

  const createAndSelectRepo = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newRepoName.trim();
    setError('');
    if (!name || !/^[\w.-]+$/.test(name)) {
      setError('New repository name may only contain letters, numbers, dots, dashes, and underscores.');
      return;
    }
    setPushing(true);
    setPushStep('Creating repository…');
    try {
      const created = await GitHubService.createRepo({ name, description: newRepoDesc.trim() || undefined, private: newRepoPrivate });
      const fullName = created.full_name || `${gitLogin || 'me'}/${created.name || name}`;
      setRepos((prev) => [created, ...prev.filter((r) => r.full_name !== fullName)]);
      setSelectedRepo(fullName);
      setNewRepoOpen(false);
      setNewRepoName('');
      setNewRepoDesc('');
      setNotice(`Created repository ${fullName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPushing(false);
      setPushStep('');
    }
  };

  const pushToGitHub = async () => {
    if (!activeProjectPath) return;
    setError('');
    setNotice('');
    setPushing(true);
    try {
      const [owner, repo] = selectedRepo.split('/');
      if (!owner || !repo) throw new Error('Choose a repository to push to.');
      setPushStep('Scanning project files…');
      const { files, bytes } = await stageProject(activeProjectPath);
      setStaged({ count: files.length, bytes });
      setPushStep(`Uploading ${files.length} files (${formatBytes(bytes)})…`);
      const message = commitMessage.trim() || autoCommitMessage();
      const result = await GitHubService.pushFiles({
        owner,
        repo,
        branch: branch.trim() || 'main',
        files,
        message,
      });
      setPushStep('');
      setNotice(`Pushed ${result.filesPushed} files to ${owner}/${repo}@${result.branch} — commit ${result.commitSha.slice(0, 7)}. View: ${result.htmlUrl}`);
      useGiaStore.getState().addNotification(
        `Pushed ${result.filesPushed} files to ${owner}/${repo} (${result.branch}) · commit ${result.commitSha.slice(0, 7)} · ${result.htmlUrl}`,
      );
      // Content changed on disk→remote: bump the project's updatedAt.
      useGiaStore.getState().touchProject(activeProjectPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPushStep('');
    } finally {
      setPushing(false);
    }
  };

  // Projects sorted by updatedAt (desc) when metadata exists, falling back
  // to alphabetical for never-touched folders.
  const sortedProjects = useMemo(() => {
    const stamp = (name: string) => projectMeta[`${PROJECTS_DIRECTORY}/${name}`]?.updatedAt ?? 0;
    return [...projects].sort((a, b) => stamp(b.name) - stamp(a.name) || a.name.localeCompare(b.name));
  }, [projects, projectMeta]);

  const breadcrumbs = currentDirectory.split('/').filter(Boolean).slice(1);

  const inputStyle = { background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Project workspace">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close project workspace" />
      <section ref={panelRef} className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--gia-border)' }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}>
              <FolderGit2 size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Project workspace</h2>
              <p className="truncate text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
                {activeProjectPath || `${PROJECTS_DIRECTORY} · sandbox storage`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => { if (pushView) setPushView(false); else void openPushView(); }}
              disabled={pushing || reposLoading}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-60"
              style={pushView
                ? { background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }
                : { background: 'var(--gia-text)', color: 'var(--gia-bg)' }}
              aria-label={pushView ? 'Back to files' : 'Push to GitHub'}
            >
              {pushView ? <X size={13} /> : <Upload size={13} />}
              {pushView ? 'Close push' : 'Push to GitHub'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2" style={{ color: 'var(--gia-muted)' }} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)] md:overflow-hidden">
          <aside className="flex min-h-0 flex-col border-b md:border-b-0 md:border-r" style={{ borderColor: 'var(--gia-border)' }}>
            <form onSubmit={cloneRepository} className="space-y-2 border-b p-3 sm:p-4" style={{ borderColor: 'var(--gia-border)' }}>
              <label className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Clone a repository</label>
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo.git"
                aria-label="Repository URL"
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={inputStyle}
              />
              <div className="flex gap-2">
                <input
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder="Folder name (optional)"
                  aria-label="Project folder name"
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                  style={inputStyle}
                />
                <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60" style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
                  {busy ? <LoaderCircle size={13} className="animate-spin" /> : <GitBranch size={13} />}
                  Clone
                </button>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                Repositories are stored in GIA's sandbox at <code>{PROJECTS_DIRECTORY}</code>, not in your device's Documents folder.
              </p>
            </form>

            <section className="space-y-2 border-b p-3 sm:p-4" style={{ borderColor: 'var(--gia-border)' }}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="github-repo-search" className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Discover on GitHub</label>
                <button type="button" onClick={connectGitHub} className="shrink-0 text-[10px] font-medium" style={{ color: hasGitHubToken ? 'var(--gia-text)' : 'var(--gia-muted)' }}>
                  {hasGitHubToken ? (gitLogin ? `Connected as ${gitLogin}` : 'Token connected') : 'Add GitHub token'}
                </button>
              </div>
              <form onSubmit={searchGitHub} className="flex gap-2">
                <input
                  id="github-repo-search"
                  value={repoQuery}
                  onChange={(event) => setRepoQuery(event.target.value)}
                  placeholder="Search repositories"
                  aria-label="Search GitHub repositories"
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                  style={inputStyle}
                />
                <button type="submit" disabled={searchingRepos || !repoQuery.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs disabled:opacity-50" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
                  {searchingRepos ? <LoaderCircle size={13} className="animate-spin" /> : <Search size={13} />}
                  Search
                </button>
              </form>
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                Public repositories can be searched without a token. Connect a fine-grained token with repository read access to find and clone private repos.
              </p>
              {githubRepos.length > 0 && (
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {githubRepos.map((repo) => (
                    <div key={repo.id} className="flex items-center gap-2 rounded-lg px-2 py-2" style={{ background: 'var(--gia-surface-2)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{repo.full_name}</p>
                        <p className="truncate text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{repo.description || repo.language || 'Repository'}</p>
                      </div>
                      <button type="button" aria-label={`Clone ${repo.full_name}`} disabled={busy} onClick={() => void cloneDiscoveredRepo(repo)} className="rounded-md px-2 py-1 text-[9px] font-semibold disabled:opacity-50" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
                        Clone
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!searchingRepos && repoQuery.trim() && githubRepos.length === 0 && !error && (
                <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>No repositories found yet. Search to discover public and accessible private repositories.</p>
              )}
            </section>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Projects</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMgmt({ mode: 'create', value: '' })}
                    disabled={busy}
                    className="rounded-md p-1.5 disabled:opacity-50"
                    style={{ color: 'var(--gia-muted)' }}
                    aria-label="New blank project"
                    title="New blank project"
                  >
                    <Plus size={13} />
                  </button>
                  <button type="button" onClick={() => void loadProjects()} disabled={loading} className="rounded-md p-1.5 disabled:opacity-50" style={{ color: 'var(--gia-muted)' }} aria-label="Refresh projects">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              {mgmt && (
                <form
                  className="mx-2 mb-2 space-y-2 rounded-xl p-2.5"
                  style={{ background: 'var(--gia-surface-2)' }}
                  onSubmit={(event) => { event.preventDefault(); void confirmMgmt(); }}
                >
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--gia-text)' }}>
                    {mgmt.mode === 'create' ? 'New blank project folder' : `Rename "${mgmt.original}"`}
                  </p>
                  <input
                    value={mgmt.value}
                    onChange={(event) => setMgmt({ ...mgmt, value: event.target.value })}
                    placeholder="project-name"
                    aria-label={mgmt.mode === 'create' ? 'New project name' : 'Renamed project name'}
                    autoFocus
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold disabled:opacity-60" style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
                      {mgmt.mode === 'create' ? 'Create' : 'Rename'}
                    </button>
                    <button type="button" onClick={() => setMgmt(null)} className="flex-1 rounded-lg px-2 py-1.5 text-[10px]" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              <div className="min-h-[90px] flex-1 overflow-y-auto px-2 pb-3">
                {projects.length === 0 && !loading ? (
                  <div className="px-3 py-5 text-center text-xs" style={{ color: 'var(--gia-muted-2)' }}>No projects yet. Clone one or create a blank project to get started.</div>
                ) : sortedProjects.map((project) => {
                  const selected = activeName === project.name;
                  const meta = projectMeta[`${PROJECTS_DIRECTORY}/${project.name}`];
                  return (
                    <div
                      key={project.name}
                      className="mb-1 flex items-center gap-1 rounded-xl px-2 py-1.5 transition-colors"
                      style={{ background: selected ? 'var(--gia-surface-2)' : 'transparent' }}
                    >
                      <button
                        type="button"
                        onClick={() => void openProject(project.name)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left"
                        style={{ color: selected ? 'var(--gia-text)' : 'var(--gia-muted)' }}
                        aria-label={`Open project ${project.name}`}
                      >
                        <Folder size={15} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{meta?.displayName || project.name}</span>
                          <span className="block truncate text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
                            {meta ? `opened ${relativeTime(meta.lastOpenedAt)} · updated ${relativeTime(meta.updatedAt)}` : 'never opened'}
                          </span>
                        </span>
                        {selected && <Check size={13} className="shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMgmt({ mode: 'rename', original: project.name, value: project.name })}
                        disabled={busy}
                        className="shrink-0 rounded-md p-1 disabled:opacity-40"
                        style={{ color: 'var(--gia-muted-2)' }}
                        aria-label={`Rename project ${project.name}`}
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(project.name)}
                        disabled={busy}
                        className="shrink-0 rounded-md p-1 disabled:opacity-40"
                        style={{ color: 'var(--gia-muted-2)' }}
                        aria-label={`Delete project ${project.name}`}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {confirmDelete && (
                <div className="mx-2 mb-3 rounded-xl p-2.5" style={{ background: 'var(--gia-surface-2)' }} role="alertdialog" aria-label={`Confirm delete ${confirmDelete}`}>
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-text)' }}>
                    Delete <strong>{confirmDelete}</strong>? Its files are removed from the sandbox workspace. This cannot be undone.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteProject(confirmDelete)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold disabled:opacity-60"
                      style={{ background: '#b91c1c', color: '#fff' }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-[10px]"
                      style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <main className="flex min-h-[300px] min-w-0 flex-col md:min-h-0">
            {pushView ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                {!hasGitHubToken ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <Upload size={28} style={{ color: 'var(--gia-muted-2)' }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Connect a GitHub token to push</p>
                    <p className="max-w-sm text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                      Pushing needs a fine-grained token with Contents read &amp; write permission for the target repository.
                    </p>
                    <button type="button" onClick={connectGitHub} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
                      Connect GitHub token
                    </button>
                  </div>
                ) : !activeName ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <Upload size={28} style={{ color: 'var(--gia-muted-2)' }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Choose an active project first</p>
                    <p className="max-w-sm text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Select a project on the left, then push its files to a GitHub repository.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Push <span className="font-mono">{activeName}</span> to GitHub</h3>
                      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
                        Files are staged from <span className="font-mono">{activeProjectPath}</span> (node_modules, .git, dist, build, __pycache__ excluded; max {MAX_PUSH_FILES} files / {formatBytes(MAX_PUSH_BYTES)}).
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="push-repo-select" className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Repository</label>
                      <div className="flex gap-2">
                        <select
                          id="push-repo-select"
                          value={selectedRepo}
                          onChange={(event) => setSelectedRepo(event.target.value)}
                          disabled={reposLoading || pushing}
                          aria-label="Target repository"
                          className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-xs outline-none"
                          style={inputStyle}
                        >
                          <option value="">{reposLoading ? 'Loading repositories…' : 'Select a repository…'}</option>
                          {repos.map((repo) => (
                            <option key={repo.id} value={repo.full_name}>{repo.full_name}{repo.private ? ' (private)' : ''}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setNewRepoOpen((open) => !open)}
                          disabled={pushing}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-semibold disabled:opacity-60"
                          style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}
                        >
                          <Plus size={12} /> New
                        </button>
                      </div>
                    </div>

                    {newRepoOpen && (
                      <form onSubmit={createAndSelectRepo} className="space-y-2 rounded-xl p-3" style={{ background: 'var(--gia-surface-2)' }}>
                        <input
                          value={newRepoName}
                          onChange={(event) => setNewRepoName(event.target.value)}
                          placeholder="new-repo-name"
                          aria-label="New repository name"
                          className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                          style={inputStyle}
                        />
                        <input
                          value={newRepoDesc}
                          onChange={(event) => setNewRepoDesc(event.target.value)}
                          placeholder="Description (optional)"
                          aria-label="New repository description"
                          className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                          style={inputStyle}
                        />
                        <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--gia-text)' }}>
                          <input
                            type="checkbox"
                            checked={newRepoPrivate}
                            onChange={(event) => setNewRepoPrivate(event.target.checked)}
                            aria-label="New repository is private"
                          />
                          Private repository
                        </label>
                        <div className="flex gap-2">
                          <button type="submit" disabled={pushing} className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold disabled:opacity-60" style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}>
                            Create repository
                          </button>
                          <button type="button" onClick={() => setNewRepoOpen(false)} className="flex-1 rounded-lg px-2 py-1.5 text-[11px]" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label htmlFor="push-branch" className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Branch</label>
                        <input
                          id="push-branch"
                          value={branch}
                          onChange={(event) => setBranch(event.target.value)}
                          placeholder="main"
                          className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                          style={inputStyle}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="push-commit-message" className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Commit message</label>
                        <input
                          id="push-commit-message"
                          value={commitMessage}
                          onChange={(event) => setCommitMessage(event.target.value)}
                          className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: 'var(--gia-surface-2)' }}>
                      {/* Single string (no nested elements) so the preview is
                          one text node for screen readers and tests. */}
                      <div className="min-w-0 text-[11px]" style={{ color: 'var(--gia-text)' }}>
                        {staged
                          ? `Staged ${staged.count} files · ${formatBytes(staged.bytes)}`
                          : 'Not staged yet — scan the project to preview the push.'}
                      </div>
                      <button
                        type="button"
                        onClick={() => void stageForPush()}
                        disabled={pushing}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-60"
                        style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}
                      >
                        <RefreshCw size={11} className={pushStep.includes('Scanning') ? 'animate-spin' : ''} />
                        {staged ? 'Re-scan' : 'Scan'}
                      </button>
                    </div>

                    {pushStep && (
                      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--gia-muted)' }} role="status">
                        <LoaderCircle size={12} className="animate-spin" /> {pushStep}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => void pushToGitHub()}
                      disabled={pushing || !selectedRepo || (!staged && !pushStep)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-60"
                      style={{ background: 'var(--gia-text)', color: 'var(--gia-bg)' }}
                    >
                      {pushing ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                      {pushing ? 'Pushing…' : `Push ${staged ? `${staged.count} files` : ''} to ${selectedRepo || 'GitHub'}`}
                    </button>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
                      The push creates one commit on the chosen branch (created from the default branch if missing) and never force-updates the ref. Untracked remote files stay untouched.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex min-h-11 items-center gap-1 overflow-x-auto border-b px-3" style={{ borderColor: 'var(--gia-border)' }}>
                  {currentDirectory && (
                    <button type="button" onClick={goUp} className="mr-1 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                      <ArrowLeft size={12} /> Back
                    </button>
                  )}
                  <button type="button" onClick={() => { setEntries([]); setCurrentDirectory(''); setPreview(null); }} className="shrink-0 text-[10px]" style={{ color: currentDirectory ? 'var(--gia-muted)' : 'var(--gia-text)' }}>
                    Projects
                  </button>
                  {breadcrumbs.map((part, index) => (
                    <React.Fragment key={`${part}-${index}`}>
                      <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--gia-muted-2)' }} />
                      <span className="max-w-32 truncate text-[10px]" style={{ color: index === breadcrumbs.length - 1 ? 'var(--gia-text)' : 'var(--gia-muted)' }}>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
                {!activeName ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                    <FolderGit2 size={28} style={{ color: 'var(--gia-muted-2)' }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Choose a project to browse its files</p>
                    <p className="max-w-sm text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>Once selected, GIA will run terminal commands in that repository and use its files as the active Build workspace.</p>
                  </div>
                ) : currentDirectory ? (
                  <div className="grid min-h-0 flex-1 md:grid-rows-[minmax(130px,0.75fr)_minmax(150px,1.25fr)]">
                    <div className="min-h-0 overflow-y-auto p-2">
                      {entries.length === 0 && !loading ? (
                        <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--gia-muted-2)' }}>This folder is empty.</p>
                      ) : entries.map((entry) => (
                        <button
                          type="button"
                          key={entry.name}
                          onClick={() => void openEntry(entry)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[var(--gia-surface-2)]"
                          style={{ color: entry.isDir ? 'var(--gia-muted)' : 'var(--gia-text)' }}
                        >
                          {entry.isDir ? <Folder size={14} className="shrink-0" /> : canPreview(entry) ? <FileCode2 size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                          <span className="min-w-0 flex-1 truncate text-xs">{entry.name}</span>
                          {!entry.isDir && <span className="shrink-0 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{entry.size.toLocaleString()} B</span>}
                        </button>
                      ))}
                    </div>
                    <section className="flex min-h-0 flex-col border-t" style={{ borderColor: 'var(--gia-border)', background: 'var(--gia-surface-2)' }}>
                      <div className="flex min-h-9 items-center gap-2 border-b px-3" style={{ borderColor: 'var(--gia-border)' }}>
                        <FileCode2 size={12} style={{ color: 'var(--gia-muted)' }} />
                        <span className="truncate text-[10px] font-medium" style={{ color: 'var(--gia-muted)' }}>{preview?.path || 'Select a text file to preview'}</span>
                      </div>
                      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed" style={{ color: preview ? 'var(--gia-text)' : 'var(--gia-muted-2)' }}>
                        {preview?.content || 'Repository files are browsable here. Ask GIA to edit or test files in the active project.'}
                      </pre>
                    </section>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-xs" style={{ color: 'var(--gia-muted-2)' }}>Select a project from the left to view its file tree.</div>
                )}
              </>
            )}
          </main>
        </div>

        {(error || notice) && (
          <div className="flex items-start gap-2 border-t px-4 py-2.5 text-[11px]" style={{ borderColor: 'var(--gia-border)', color: error ? '#fca5a5' : 'var(--gia-muted)' }} role={error ? 'alert' : 'status'}>
            {error ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <Check size={13} className="mt-0.5 shrink-0" />}
            <span className="min-w-0 break-words">{error || notice}</span>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectWorkspacePanel;
