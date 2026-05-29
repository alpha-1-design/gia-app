/**
 * Desktop File System Access API wrapper.
 * Provides read/write/list access to a user-picked directory.
 * Requires user gesture for initial directory selection.
 * Handle persisted in IndexedDB via simple localStorage stub.
 */

const STORAGE_KEY = 'gia-desktop-fs-handle';

interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
}

class DesktopFS {
  private _handle: FileSystemDirectoryHandle | null = null;
  private _rootName = '';

  async pickDirectory(): Promise<{ name: string } | null> {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      return null;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      this._handle = handle as FileSystemDirectoryHandle;
      this._rootName = this._handle.name;
      this._persistHandle();
      return { name: this._rootName };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null; // User cancelled
      }
      throw err;
    }
  }

  async restoreHandle(): Promise<boolean> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const { name } = JSON.parse(raw);
      const handles = await (navigator as any).storage?.getDirectory?.();
      if (handles) {
        // In secure contexts, we can request the handle again
        // but for simplicity, require re-pick on page reload
        this._handle = null;
        this._rootName = '';
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }

  get rootName(): string {
    return this._rootName || this._handle?.name || '';
  }

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  get hasHandle(): boolean {
    return this._handle !== null;
  }

  async readFile(path: string): Promise<string> {
    const handle = this._ensureHandle();
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    const fileHandle = await this._resolveFile(handle, parts);
    const file = await fileHandle.getFile();
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`File exceeds 10MB limit`);
    }
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = this._ensureHandle();
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir = handle;
    for (const part of parts) {
      if (part === '..') throw new Error('Path traversal not allowed');
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async listFiles(path = ''): Promise<FileEntry[]> {
    const handle = this._ensureHandle();
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    let dir = handle;
    for (const part of parts) {
      if (part === '..') throw new Error('Path traversal not allowed');
      dir = await dir.getDirectoryHandle(part);
    }
    const entries: FileEntry[] = [];
    // `entries()` is a standard method on FileSystemDirectoryHandle
    for await (const [name, entry] of (dir as any).entries()) {
      entries.push({
        name,
        path: path ? `${path}/${name}` : name,
        kind: entry.kind as 'file' | 'directory',
      });
    }
    return entries;
  }

  private _ensureHandle(): FileSystemDirectoryHandle {
    if (!this._handle) throw new Error('No directory selected. Pick a folder first.');
    return this._handle;
  }

  private async _resolveFile(
    dir: FileSystemDirectoryHandle,
    parts: string[]
  ): Promise<FileSystemFileHandle> {
    let current = dir;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === '..') throw new Error('Path traversal not allowed');
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileName = parts[parts.length - 1];
    return current.getFileHandle(fileName);
  }

  private _persistHandle(): void {
    try {
      // We can't persist FileSystemDirectoryHandle directly to localStorage,
      // but we can store the name for display. Require re-pick on reload.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: this._rootName }));
    } catch {}
  }
}

export default new DesktopFS();
