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
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  license: { spdx_id: string } | null;
  updated_at: string;
  archived: boolean;
  fork: boolean;
}

export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

const GITHUB_API = 'https://api.github.com';

class GitHubService {
  async getUser(username: string): Promise<GitHubUser> {
    const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async listRepos(username: string, sort: 'updated' | 'created' | 'pushed' | 'full_name' = 'updated'): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=${sort}`);
      if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      const batch: GitHubRepo[] = await res.json();
      if (batch.length === 0) break;
      repos.push(...batch);
      page++;
    }
    return repos;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async listRepoContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    return data.content || JSON.stringify(data);
  }

  async getReadme(owner: string, repo: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    return data.content || '';
  }
}

export default new GitHubService();
