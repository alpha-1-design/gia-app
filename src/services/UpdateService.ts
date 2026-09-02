import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { GIAUpdate } from './GIAUpdate';
import { logger } from '../utils/logger';

const OWNER = 'alpha-1-design';
const REPO = 'gia-app';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const CACHE_TTL = 5 * 60 * 1000;

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  downloadUrl: string;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
  body: string;
  size: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function formatSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

class UpdateService {
  private checking = false;
  private cachedUpdate: UpdateInfo | null = null;
  private cacheTime = 0;

  getCachedUpdate(): UpdateInfo | null {
    if (this.cachedUpdate && Date.now() - this.cacheTime < CACHE_TTL) {
      return this.cachedUpdate;
    }
    return null;
  }

  async checkForUpdate(): Promise<UpdateInfo | null> {
    const cached = this.getCachedUpdate();
    if (cached) return cached;
    if (this.checking) return null;
    this.checking = true;

    try {
      const appInfo = await CapacitorApp.getInfo();
      const currentVersion = appInfo.version;

      const res = await fetch(API, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;

      const release = await res.json();
      const tagVersion = (release.tag_name || '').replace(/^v/, '');
      if (!tagVersion || tagVersion === currentVersion) return null;

      const assets: { name: string; size: number; browser_download_url: string }[] = release.assets ?? [];
      const asset = assets.find(a => a.name === 'app-release.apk')
        ?? assets.find(a => a.name.endsWith('.apk'));
      if (!asset) return null;

      this.cachedUpdate = {
        version: tagVersion,
        currentVersion,
        downloadUrl: asset.browser_download_url,
        releaseUrl: release.html_url,
        releaseName: release.name || release.tag_name,
        publishedAt: release.published_at,
        body: release.body || '',
        size: asset.size,
      };
      this.cacheTime = Date.now();
      return this.cachedUpdate;
    } catch (e) {
      logger.warn('[UpdateService] Check failed:', e);
      return null;
    } finally {
      this.checking = false;
    }
  }

  async downloadUpdate(
    url: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<void> {
    // On Android, use native HttpURLConnection download — avoids the
    // WebView blob→base64 OOM that crashes on low-end devices with 21MB APKs.
    const isNative = !!(window as any).Capacitor?.isNativePlatform;
    if (isNative) {
      try {
        const result = await GIAUpdate.downloadAndInstall({ url });
        // downloadAndInstall handles both download + install trigger
        // Emit a synthetic progress event so the UI knows it succeeded
        if (onProgress) {
          onProgress({ loaded: 100, total: 100, percent: 100 });
        }
        // The install intent was already fired by native side — we're done
        return;
      } catch (e) {
        // If native download fails, don't retry with web method
        throw e;
      }
    }

    // Web fallback: XHR blob→base64 pipeline (only runs in browser)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';

      xhr.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      };

      xhr.onload = async () => {
        if (xhr.status !== 200) {
          reject(new Error(`Download failed: ${xhr.status}`));
          return;
        }
        try {
          const blob = xhr.response as Blob;
          const base64 = await blobToBase64(blob);
          await Filesystem.writeFile({
            path: 'update.apk',
            data: base64,
            directory: Directory.Cache,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      xhr.onerror = () => reject(new Error('Download failed'));
      xhr.send();
    });
  }

  async installUpdate(): Promise<void> {
    // On native, install is already triggered by downloadAndInstall.
    // This is only called for the web fallback path.
    const isNative = !!(window as any).Capacitor?.isNativePlatform;
    if (isNative) return; // Already handled by downloadAndInstall

    try {
      await GIAUpdate.installApk({ fileName: 'update.apk' });
    } catch (e) {
      logger.error('[UpdateService] Install failed:', e);
      throw e;
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const updateService = new UpdateService();
