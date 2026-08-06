import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { logger } from '../utils/logger';
import { isNativePlatform } from '../utils/helpers';
import { isPathSafe } from './tools/helpers';

/**
 * Mobile File System wrapper (Capacitor).
 * Mirrors DesktopFS's public interface (isAvailable, hasHandle, rootName,
 * pickDirectory, listFiles, readFile) so FileBrowser can use either backend
 * without branching UI logic.
 *
 * Unlike the browser File System Access API, Capacitor's Filesystem plugin
 * doesn't need a user-picked directory handle — it already has access to the
 * app's Documents directory (the same directory the filesystem_read /
 * filesystem_write tools use). "Picking" here just confirms that access and
 * flips the UI into browse mode; there's no native folder-chooser involved.
 */

interface FileEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
}

class MobileFS {
  private _hasHandle = false;

  get isAvailable(): boolean {
    return isNativePlatform();
  }

  get hasHandle(): boolean {
    return this._hasHandle;
  }

  get rootName(): string {
    return 'Documents';
  }

  // No native picker involved — Documents is always the root on mobile.
  // Kept async + same return shape as DesktopFS.pickDirectory for drop-in use.
  async pickDirectory(): Promise<{ name: string } | null> {
    if (!this.isAvailable) return null;
    this._hasHandle = true;
    return { name: this.rootName };
  }

  async listFiles(path = ''): Promise<FileEntry[]> {
    const pathErr = isPathSafe(path);
    if (pathErr) throw new Error(pathErr);
    try {
      const result = await Filesystem.readdir({ path, directory: Directory.Documents });
      return result.files
        .map((f) => ({
          name: f.name,
          path: path ? `${path}/${f.name}` : f.name,
          kind: (f.type === 'directory' ? 'directory' : 'file') as 'file' | 'directory',
          size: f.size,
        }))
        .sort((a, b) => (a.kind !== b.kind ? (a.kind === 'directory' ? -1 : 1) : a.name.localeCompare(b.name)));
    } catch (e: unknown) {
      logger.error('[MobileFS] listFiles failed:', e);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async readFile(path: string): Promise<string> {
    const pathErr = isPathSafe(path);
    if (pathErr) throw new Error(pathErr);
    const stat = await Filesystem.stat({ path, directory: Directory.Documents }).catch(() => null);
    if (stat && stat.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10MB limit');
    }
    const result = await Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 });
    return result.data as string;
  }
}

export default new MobileFS();
