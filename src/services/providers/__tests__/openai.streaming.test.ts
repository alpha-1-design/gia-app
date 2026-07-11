import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../store/useProviderStore', () => ({
  useProviderStore: {
    getState: () => ({
      activeProvider: 'opencode',
      providers: { opencode: { apiKey: 'test-key', model: 'deepseek-v4-flash-free' } },
    }),
  },
}));

vi.mock('../../ProviderRegistry', () => ({
  providerRegistry: {
    getBaseUrl: () => 'https://api.opencode.example',
    getLabel: () => 'OpenCode Zen',
  },
}));

vi.mock('../../../store/useGiaStore', () => ({
  useGiaStore: { getState: () => ({ handsOff: false }) },
}));

const proxyUrlMock = vi.fn((url: string) => `https://cors-proxy.example/?u=${encodeURIComponent(url)}`);
vi.mock('../../CorsProxy', () => ({
  corsProxy: { proxyUrl: (url: string) => proxyUrlMock(url) },
}));

const { callOpenAICompat } = await import('../openai');

// Minimal fake XMLHttpRequest that lets tests drive onprogress/onload/onerror
// and record which URL(s) were opened.
class FakeXHR {
  static instances: FakeXHR[] = [];
  url = '';
  responseText = '';
  responseType = '';
  timeout = 0;
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private headers: Record<string, string> = {};

  constructor() { FakeXHR.instances.push(this); }
  open(_method: string, url: string) { this.url = url; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send() { /* test drives events manually */ }
  abort() { this.onabort?.(); }

  // test helpers
  pushSSE(dataLines: string[]) {
    this.responseText += dataLines.map(l => `data: ${l}\n\n`).join('');
    this.onprogress?.();
  }
  finish() { this.onload?.(); }
  fail() { this.onerror?.(); }
}

const ctx = {
  buildSystemPrompt: (p: string) => p,
  buildMessages: async () => [{ role: 'user', content: 'hi' }],
  buildOpenAITools: () => undefined,
  buildAnthropicTools: () => undefined,
  buildGeminiTools: () => undefined,
  retryFetch: vi.fn(),
  friendlyError: (label: string, e: unknown) => `${label}: ${String(e)}`,
} as unknown as Parameters<typeof callOpenAICompat>[1];

describe('callOpenAICompat — streaming', () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    proxyUrlMock.mockClear();
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
  });

  it('delivers text to onStream incrementally as chunks arrive, not just once at the end', async () => {
    const received: string[] = [];
    const promise = callOpenAICompat(
      { prompt: 'hi', onStream: (chunk) => received.push(chunk) } as Parameters<typeof callOpenAICompat>[0],
      ctx,
    );

    await Promise.resolve();
    const xhr = FakeXHR.instances[0];
    expect(xhr).toBeTruthy();

    xhr.pushSSE(['{"choices":[{"delta":{"content":"Hel"}}]}']);
    expect(received).toEqual(['Hel']);

    xhr.pushSSE(['{"choices":[{"delta":{"content":"lo "}}]}']);
    expect(received).toEqual(['Hel', 'lo ']);

    xhr.pushSSE(['{"choices":[{"delta":{"content":"there"}}]}', '[DONE]']);
    expect(received).toEqual(['Hel', 'lo ', 'there']);

    xhr.finish();
    const res = await promise;
    expect(res.text).toBe('Hello there');
  });

  it('retries through the CORS proxy when the direct streaming request fails before any bytes arrive', async () => {
    const received: string[] = [];
    const promise = callOpenAICompat(
      { prompt: 'hi', onStream: (chunk) => received.push(chunk) } as Parameters<typeof callOpenAICompat>[0],
      ctx,
    );

    await Promise.resolve();
    const first = FakeXHR.instances[0];
    first.fail(); // simulate an immediate CORS/network failure, no data received

    await Promise.resolve();
    await Promise.resolve();

    expect(FakeXHR.instances.length).toBe(2);
    expect(proxyUrlMock).toHaveBeenCalledWith('https://api.opencode.example/chat/completions');

    const second = FakeXHR.instances[1];
    second.pushSSE(['{"choices":[{"delta":{"content":"recovered"}}]}']);
    second.finish();

    const res = await promise;
    expect(res.text).toBe('recovered');
    expect(received).toEqual(['recovered']);
  });

  it('does not retry if the connection drops after some content already streamed', async () => {
    const promise = callOpenAICompat(
      { prompt: 'hi', onStream: () => {} } as Parameters<typeof callOpenAICompat>[0],
      ctx,
    );
    await Promise.resolve();
    const xhr = FakeXHR.instances[0];
    xhr.pushSSE(['{"choices":[{"delta":{"content":"partial"}}]}']);
    xhr.fail();

    await expect(promise).rejects.toThrow();
    expect(FakeXHR.instances.length).toBe(1);
  });
});
