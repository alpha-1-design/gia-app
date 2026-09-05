import { logger } from '../../utils/logger';

const blobUrls = new Set<string>();

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_DIRECTORIES = ['Documents', 'Download'];

export const isPathSafe = (path: string): string | null => {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.includes('..')) return 'Path traversal is not allowed';
  return null;
};

// All filesystem tools are rooted at the app's Documents directory
// (see Directory.Documents usage in filesystem.ts) — a leading '/' just
// means "from the root of that sandbox", not an OS absolute path, so we
// strip it rather than reject the call outright. The model has no way to
// know the sandbox root ahead of time, so failing hard here just causes
// it to retry blindly (see ISSUES.md #2).
export const normalizePath = (path: string): string => path.replace(/\\/g, '/').replace(/^\/+/, '');

export const revokeAllBlobUrls = () => {
  blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { logger.error('[helpers] Failed to revoke blob URL:', e); } });
  blobUrls.clear();
};

export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read blob data'));
    reader.readAsDataURL(blob);
  });

export const triggerDownload = (blob: Blob, filename: string) => {
  revokeAllBlobUrls();
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    if (blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      blobUrls.delete(url);
    }
  }, 30000);
};
