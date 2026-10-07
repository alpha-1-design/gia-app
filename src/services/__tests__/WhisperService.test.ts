import { describe, it, expect, vi, beforeEach } from 'vitest';

function fakeCacheStore(entries: Record<string, number>) {
  const store = new Map(Object.entries(entries));
  const cache = {
    keys: async () => [...store.keys()].map(url => new Request(url)),
    match: async (req: Request) => store.has(req.url) ? new Response('x', { headers: { 'content-length': String(store.get(req.url)) } }) : undefined,
    delete: async (req: Request) => store.delete(req.url),
  };
  vi.stubGlobal('caches', { has: async () => true, open: async () => cache });
  return store;
}

describe('WhisperService', () => {
  beforeEach(() => { vi.resetModules(); });

  it('reports download progress aggregated across files', async () => {
    vi.doMock('@huggingface/transformers', () => ({
      pipeline: async (_t: string, _m: string, opts: { progress_callback: (e: object) => void }) => {
        opts.progress_callback({ status: 'progress', file: 'a.onnx', loaded: 50, total: 100 });
        opts.progress_callback({ status: 'progress', file: 'b.onnx', loaded: 0, total: 100 });
        return async () => ({ text: 'hi' });
      },
    }));
    const svc = (await import('../WhisperService')).default;
    const seen: Array<number | null> = [];
    svc.subscribe(() => seen.push(svc.progress.percent));
    await svc.loadModel();
    expect(seen).toContain(25);
    expect(svc.status).toBe('ready');
  });

  it('records why a download failed', async () => {
    vi.doMock('@huggingface/transformers', () => ({ pipeline: async () => { throw new Error('401 Unauthorized'); } }));
    const svc = (await import('../WhisperService')).default;
    await expect(svc.loadModel()).rejects.toThrow();
    expect(svc.status).toBe('error');
    expect(svc.error).toContain('401');
  });

  it('deleteModel removes cached whisper files and nothing else', async () => {
    const store = fakeCacheStore({
      'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder.onnx': 1000,
      'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/config.json': 200,
      'https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/model.onnx': 5000,
    });
    const svc = (await import('../WhisperService')).default;
    expect(await svc.getCachedBytes()).toBe(1200);
    expect(await svc.deleteModel()).toBe(1200);
    expect([...store.keys()]).toEqual(['https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/model.onnx']);
    expect(svc.status).toBe('unloaded');
  });
});
