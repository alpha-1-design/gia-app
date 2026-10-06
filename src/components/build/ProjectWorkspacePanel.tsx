import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronRight, FileCode2, FileText, Folder, FolderGit2, GitBranch, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
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

function repoFolderName(repo: string): string {
  return repo.replace(/\/+$/, '').split(/[/:]/).pop()?.replace(/\.git$/i, '') || '';
}

function canPreview(entry: SandboxFileEntry): boolean {
  return !entry.isDir && TEXT_EXTENSIONS.has(entry.name.split('.').pop()?.toLowerCase() || '');
}

const ProjectWorkspacePanel: React.FC<ProjectWorkspacePanelProps> = ({ onClose }) => {
  const activeProjectPath = useGiaStore((state) => state.activeProjectPath);
  const setActiveProjectPath = useGiaStore((state) => state.setActiveProjectPath);
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

  const activeName = useMemo(() => activeProjectPath?.split('/').filter(Boolean).pop() || '', [activeProjectPath]);

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
      setProjects(result.filter((entry) => entry.isDir && entry.name !== '.' && entry.name !== '..').sort((a, b) => a.name.localeCompare(b.name)));
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
    setActiveProjectPath(path);
    setPreview(null);
    setNotice(`${name} is now GIA's active project.`);
    await loadDirectory(`projects/${name}`);
  }, [loadDirectory, setActiveProjectPath]);

  useEffect(() => {
    if (!activeName) return;
    if (projects.some((project) => project.name === activeName)) {
      void loadDirectory(`projects/${activeName}`);
    }
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
      description: 'Add a GitHub fine-grained personal access token with repository metadata and contents read access. It is stored locally and used only for GitHub discovery and cloning private repositories.',
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

  const breadcrumbs = currentDirectory.split('/').filter(Boolean).slice(1);

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Project workspace">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close project workspace" />
      <section className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--gia-border)' }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(249,115,22,0.14)', color: '#fb923c' }}>
              <FolderGit2 size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Project workspace</h2>
              <p className="truncate text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
                {activeProjectPath || `${PROJECTS_DIRECTORY} · sandbox storage`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2" style={{ color: 'var(--gia-muted)' }} aria-label="Close">
            <X size={16} />
          </button>
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
                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
              />
              <div className="flex gap-2">
                <input
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                  placeholder="Folder name (optional)"
                  aria-label="Project folder name"
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
                />
                <button type="submit" disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60" style={{ background: '#ea580c' }}>
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
                <button type="button" onClick={connectGitHub} className="shrink-0 text-[10px] font-medium" style={{ color: hasGitHubToken ? '#86efac' : '#a78bfa' }}>
                  {hasGitHubToken ? 'Token connected' : 'Add GitHub token'}
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
                  style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}
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
                      <button type="button" aria-label={`Clone ${repo.full_name}`} disabled={busy} onClick={() => void cloneDiscoveredRepo(repo)} className="rounded-md px-2 py-1 text-[9px] font-semibold disabled:opacity-50" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
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
                <button type="button" onClick={() => void loadProjects()} disabled={loading} className="rounded-md p-1.5 disabled:opacity-50" style={{ color: 'var(--gia-muted)' }} aria-label="Refresh projects">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="min-h-[90px] flex-1 overflow-y-auto px-2 pb-3">
                {projects.length === 0 && !loading ? (
                  <div className="px-3 py-5 text-center text-xs" style={{ color: 'var(--gia-muted-2)' }}>No repositories yet. Clone one to get started.</div>
                ) : projects.map((project) => {
                  const selected = activeName === project.name;
                  return (
                    <button
                      type="button"
                      key={project.name}
                      onClick={() => void openProject(project.name)}
                      className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                      style={{ background: selected ? 'rgba(249,115,22,0.12)' : 'transparent', color: selected ? '#fb923c' : 'var(--gia-text)' }}
                    >
                      <Folder size={15} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{project.name}</span>
                      {selected && <Check size={13} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="flex min-h-[300px] min-w-0 flex-col md:min-h-0">
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
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5"
                      style={{ color: entry.isDir ? '#fbbf24' : 'var(--gia-text)' }}
                    >
                      {entry.isDir ? <Folder size={14} className="shrink-0" /> : canPreview(entry) ? <FileCode2 size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                      <span className="min-w-0 flex-1 truncate text-xs">{entry.name}</span>
                      {!entry.isDir && <span className="shrink-0 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{entry.size.toLocaleString()} B</span>}
                    </button>
                  ))}
                </div>
                <section className="flex min-h-0 flex-col border-t" style={{ borderColor: 'var(--gia-border)', background: 'rgba(0,0,0,0.14)' }}>
                  <div className="flex min-h-9 items-center gap-2 border-b px-3" style={{ borderColor: 'var(--gia-border)' }}>
                    <FileCode2 size={12} style={{ color: '#fb923c' }} />
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
          </main>
        </div>

        {(error || notice) && (
          <div className="flex items-start gap-2 border-t px-4 py-2.5 text-[11px]" style={{ borderColor: 'var(--gia-border)', color: error ? '#fca5a5' : '#86efac' }} role={error ? 'alert' : 'status'}>
            {error ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <Check size={13} className="mt-0.5 shrink-0" />}
            <span className="min-w-0 break-words">{error || notice}</span>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectWorkspacePanel;
