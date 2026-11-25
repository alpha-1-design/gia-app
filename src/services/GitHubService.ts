export interface GitHubUser {
  login: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  avatar_url: string;
  html_url: string;
  blog: string;
  location: string;
  company: string;
  created_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  license: { spdx_id: string } | null;
  updated_at: string;
  archived: boolean;
  fork: boolean;
  default_branch?: string;
  private?: boolean;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

export interface PushFilesArgs {
  owner: string;
  repo: string;
  branch: string;
  /** Repo-relative path → UTF-8 text content. */
  files: { path: string; content: string }[];
  message: string;
}

export interface PushFilesResult {
  commitSha: string;
  branch: string;
  htmlUrl: string;
  filesPushed: number;
}

export interface CreateRepoArgs {
  name: string;
  description?: string;
  private?: boolean;
}

const GITHUB_API = 'https://api.github.com';
/** Hard cap on listRepos pagination: 5 pages x 100 = 500 repos is far more
 *  than a picker dropdown needs, and an unbounded while-loop used to walk
 *  every page of large accounts before the UI could show anything. */
const MAX_REPO_PAGES = 5;

/** GitHub's contents API returns Base64. `atob` alone mangles every non-ASCII
 *  byte into Latin-1 mojibake (UTF-8 read as Windows-1252), so decode through
 *  TextDecoder('utf-8') instead. Same return contract as before, just honest. */
function decodeBase64Utf8(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replace(/\n/g, '')), (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** UTF-8-safe Base64 for the git data API. TextEncoder first, then chunked
 *  String.fromCharCode in ~32k slices — spreading the whole byte array into
 *  one fromCharCode call overflows the argument limit for large files. */
function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const CHUNK = 0x8000; // 32768 — safely below every engine's apply/spread limit.
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

interface GitRef {
  ref: string;
  object: { sha: string };
}

interface GitCommitInfo {
  sha: string;
  tree: { sha: string };
  html_url?: string;
}

interface GitTreeItem {
  path: string;
  mode: '100644' | '100755';
  type: 'blob';
  sha: string;
}

class GitHubService {
  private headers(): Record<string, string> {
    const token = credentialStore.getState().getCredential('github')?.value;
    return token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' };
  }

  hasToken(): boolean {
    return !!credentialStore.getState().getCredential('github')?.value;
  }

  /** The token's own user — `GET /user`. Distinct from getUser('me') only in
   *  intent; kept separate so callers don't have to remember the magic name. */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    const res = await fetch(`${GITHUB_API}/user`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  private async apiJSON<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GITHUB_API}${path}`, { headers: this.headers(), ...init });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`);
    }
    return res.json() as Promise<T>;
  }

  async getUser(username: string): Promise<GitHubUser> {
    const url = username === 'me' ? `${GITHUB_API}/user` : `${GITHUB_API}/users/${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async listRepos(username: string, sort: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated'): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    for (let page = 1; page <= MAX_REPO_PAGES; page++) {
      const url = username === 'me'
        ? `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=${sort}`
        : `${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=${sort}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      const batch: GitHubRepo[] = await res.json();
      if (batch.length === 0) break;
      repos.push(...batch);
      if (batch.length < 100) break;
    }
    return repos;
  }

  async searchRepositories(query: string): Promise<GitHubRepo[]> {
    const normalized = query.trim();
    if (!normalized) throw new Error('Enter a repository search query.');
    if (normalized.length > 256) throw new Error('Repository search query is too long.');
    const res = await fetch(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(normalized)}&per_page=10&sort=updated`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub repository search failed: ${res.status} ${res.statusText}`);
    const data = await res.json() as { items?: GitHubRepo[] };
    return data.items || [];
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async listRepoContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
      return decodeBase64Utf8(data.content);
    }
    return data.content || JSON.stringify(data);
  }

  async getReadme(owner: string, repo: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
      return decodeBase64Utf8(data.content);
    }
    return data.content || '';
  }

  async createRepo({ name, description, private: isPrivate }: CreateRepoArgs): Promise<GitHubRepo> {
    return this.apiJSON<GitHubRepo>('/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || undefined, private: !!isPrivate, auto_init: false }),
    });
  }

  /**
   * Push multiple text files to a branch in one commit via the git data API:
   * resolve (or create) the branch ref → use the head commit's tree as
   * base_tree → upload each file as a UTF-8-safe base64 blob → build a tree →
   * commit with author+committer → fast-forward the branch ref (force:false,
   * so a concurrent push fails loudly instead of being silently clobbered).
   */
  async pushFiles({ owner, repo, branch, files, message }: PushFilesArgs): Promise<PushFilesResult> {
    if (!branch || /[^\w.-]/.test(branch)) throw new Error('Branch name may only contain letters, numbers, dots, dashes, and underscores.');
    if (!files.length) throw new Error('No files to push.');
    if (!message.trim()) throw new Error('Commit message is required.');
    const ownerEnc = encodeURIComponent(owner);
    const repoEnc = encodeURIComponent(repo);
    const refPath = `/repos/${ownerEnc}/${repoEnc}/git/ref/heads/${encodeURIComponent(branch)}`;

    // 1. Resolve the branch ref; a 404 means create it from the default head.
    let headSha: string;
    try {
      const ref = await this.apiJSON<GitRef>(refPath);
      headSha = ref.object.sha;
    } catch (error) {
      const notFound = error instanceof Error && /GitHub API error: 404/.test(error.message);
      if (!notFound) throw error;
      const repoInfo = await this.getRepo(owner, repo);
      const defaultBranch = repoInfo.default_branch || 'main';
      const defaultRef = await this.apiJSON<GitRef>(`/repos/${ownerEnc}/${repoEnc}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
      await this.apiJSON<unknown>(`/repos/${ownerEnc}/${repoEnc}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: defaultRef.object.sha }),
      });
      headSha = defaultRef.object.sha;
    }

    // 2. Head commit's tree becomes the base so untouched files survive.
    const headCommit = await this.apiJSON<GitCommitInfo>(`/repos/${ownerEnc}/${repoEnc}/git/commits/${headSha}`);
    const baseTreeSha = headCommit.tree.sha;

    // 3. Upload every file as a blob (UTF-8-safe base64).
    const tree: GitTreeItem[] = [];
    for (const file of files) {
      const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalizedPath || normalizedPath.split('/').includes('..')) {
        throw new Error(`Refusing to push unsafe file path: ${file.path}`);
      }
      const blob = await this.apiJSON<{ sha: string }>(`/repos/${ownerEnc}/${repoEnc}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: encodeBase64Utf8(file.content), encoding: 'base64' }),
      });
      tree.push({ path: normalizedPath, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4. Build the tree, commit it, and fast-forward the branch ref.
    const newTree = await this.apiJSON<{ sha: string }>(`/repos/${ownerEnc}/${repoEnc}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree }),
    });

    const now = new Date().toISOString();
    const identity = { name: 'GIA Build Studio', email: 'gia-build-studio@users.noreply.github.com' };
    const commit = await this.apiJSON<GitCommitInfo>(`/repos/${ownerEnc}/${repoEnc}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [headSha],
        author: { ...identity, date: now },
        committer: { ...identity, date: now },
      }),
    });

    await this.apiJSON<unknown>(`/repos/${ownerEnc}/${repoEnc}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    return {
      commitSha: commit.sha,
      branch,
      htmlUrl: commit.html_url || `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
      filesPushed: files.length,
    };
  }
}

export default new GitHubService();
import credentialStore from '../store/useCredentialStore';
