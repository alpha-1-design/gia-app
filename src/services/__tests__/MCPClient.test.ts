import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClient } from '../MCPClient';
import type { MCPServerConfig } from '../../store/useMCPStore';

// BUG: _createSSETransport used to call `new SSEClientTransport(new URL(url))`
// with no second argument, so a server's stored OAuth accessToken was never
// attached to the actual connection -- auth would "succeed" (token stored)
// but the real SSE/POST requests went out unauthenticated and any
// auth-required server (e.g. GitHub's remote MCP) would fail silently.
// This test locks in that the token is now threaded through both the
// recurring POST requestInit and the SSE stream's fetch.

const capturedTransportArgs: unknown[] = [];

vi.mock('@modelcontextprotocol/sdk/client/sse', () => {
  class MockSSEClientTransport {
    constructor(url: URL, opts?: unknown) {
      capturedTransportArgs.push({ url: url.toString(), opts });
    }
  }
  return { SSEClientTransport: MockSSEClientTransport };
});

vi.mock('@modelcontextprotocol/sdk/client', () => {
  class MockClient {
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    listTools = vi.fn().mockResolvedValue({ tools: [] });
  }
  return { Client: MockClient };
});

function baseConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    id: 'test-server',
    name: 'Test Server',
    transport: 'sse',
    url: 'https://api.githubcopilot.com/mcp/',
    command: '',
    args: [],
    enabled: true,
    autoConnect: false,
    ...overrides,
  };
}

describe('MCPClient SSE transport auth', () => {
  beforeEach(() => {
    capturedTransportArgs.length = 0;
    vi.clearAllMocks();
  });

  it('attaches Authorization header when the server has an accessToken', async () => {
    const client = new MCPClient(baseConfig({ accessToken: 'gho_test_token_123' }));
    await client.connect();

    expect(capturedTransportArgs.length).toBe(1);
    const opts = capturedTransportArgs[0] as { opts?: { requestInit?: RequestInit; eventSourceInit?: { fetch?: typeof fetch } } };

    expect(opts.opts?.requestInit?.headers).toMatchObject({
      Authorization: 'Bearer gho_test_token_123',
    });
    expect(typeof opts.opts?.eventSourceInit?.fetch).toBe('function');
  });

  it('the eventSourceInit fetch actually injects the Authorization header into requests', async () => {
    const client = new MCPClient(baseConfig({ accessToken: 'gho_test_token_123' }));
    await client.connect();

    const opts = capturedTransportArgs[0] as { opts: { eventSourceInit: { fetch: typeof fetch } } };
    const injectFetch = opts.opts.eventSourceInit.fetch;

    const realFetch = global.fetch;
    let seenHeaders: Headers | undefined;
    global.fetch = vi.fn(async (_input, init) => {
      seenHeaders = new Headers(init?.headers);
      return new Response('ok');
    }) as unknown as typeof fetch;

    await injectFetch('https://api.githubcopilot.com/mcp/', {});
    expect(seenHeaders?.get('Authorization')).toBe('Bearer gho_test_token_123');

    global.fetch = realFetch;
  });

  it('does not pass auth options when there is no accessToken (unauthenticated server)', async () => {
    const client = new MCPClient(baseConfig({ accessToken: undefined }));
    await client.connect();

    expect(capturedTransportArgs.length).toBe(1);
    const call = capturedTransportArgs[0] as { opts?: unknown };
    expect(call.opts).toBeUndefined();
  });
});
