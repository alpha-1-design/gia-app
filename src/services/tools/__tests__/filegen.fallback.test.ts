import { describe, it, expect, vi, beforeEach } from 'vitest';

const readFileMock = vi.fn();
vi.mock('../../SandboxService', () => ({
  default: { readFile: (...args: unknown[]) => readFileMock(...args) },
}));

const { describeDownload, getFileBlob } = await import('../filegen');

describe('filegen — download fallback helpers', () => {
  beforeEach(() => {
    readFileMock.mockReset();
  });

  describe('describeDownload', () => {
    it('renders a real markdown link when a download URL is available', () => {
      const line = describeDownload('report.pdf', 'http://localhost:3081/fs/download?path=report.pdf');
      expect(line).toBe('[⬇ Download report.pdf](http://localhost:3081/fs/download?path=report.pdf)');
    });

    it('gives an honest, non-broken message when no download URL is available (native fallback)', () => {
      const line = describeDownload('report.pdf', null);
      expect(line).not.toContain('](null)');
      expect(line).not.toContain('undefined');
      expect(line.toLowerCase()).toContain('download_file');
      expect(line).toContain('report.pdf');
    });
  });

  describe('getFileBlob', () => {
    it('fetches from the download URL when one is available', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['remote content']),
      });
      vi.stubGlobal('fetch', fetchMock);

      const blob = await getFileBlob('report.pdf', 'http://localhost:3081/fs/download?path=report.pdf');
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3081/fs/download?path=report.pdf');
      expect(blob.size).toBeGreaterThan(0);
      vi.unstubAllGlobals();
    });

    it('reads the file content directly through the sandbox (native fallback) when there is no URL', async () => {
      readFileMock.mockResolvedValue('native file content');
      const blob = await getFileBlob('report.pdf', null);
      expect(readFileMock).toHaveBeenCalledWith('report.pdf');
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
      });
      expect(text).toBe('native file content');
    });

    it('throws a clear error when the remote fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      await expect(getFileBlob('missing.pdf', 'http://localhost:3081/fs/download?path=missing.pdf')).rejects.toThrow(/not found|inaccessible/i);
      vi.unstubAllGlobals();
    });
  });
});
