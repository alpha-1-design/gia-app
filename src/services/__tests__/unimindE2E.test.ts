/**
 * Unimind end-to-end test (mobile side).
 *
 * Mirrors gia-cowork/src/services/__tests__/unimindE2E.test.ts with the
 * roles swapped: the REAL mobile UnimindClient connects to the REAL relay
 * (gia-cowork/relay/index.js, spawned as a child process) and a raw
 * WebSocket peer plays the desktop. Verifies the whole spine:
 *
 *   - pairing (same unimindId) → peers discover each other
 *   - presence flows desktop → mobile
 *   - chat in both directions
 *   - action delegation: desktop delegates to mobile (mobile executes via
 *     the tool registry) AND mobile awaits a result the desktop returns
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WebSocket as WsWebSocket } from 'ws';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { makeEnvelope, type Device, type UnimindMessage } from '../unimind/types';
import type ToolRegistrySingleton from '../ToolRegistry';
import type { UnimindClient, UnimindPeer } from '../unimindClient';

const RELAY_PORT = 8792;
const RELAY_URL = `ws://127.0.0.1:${RELAY_PORT}/unimind`;
const UNIMIND_ID = 'e2e-shared-id';
const DESKTOP_DEVICE_ID = 'desktop-e2e-test';
// vitest runs from the gia-app repo root; the relay lives in the sibling repo.
const RELAY_PATH = path.resolve(process.cwd(), '../gia-cowork/relay/index.js');

// The relay only exists when gia-cowork is checked out as a sibling of
// gia-app (dev setup). In CI this repo is checked out standalone, so the
// E2E suite can't run — skip it with a clear message instead of failing
// with "relay exited early".
const relayAvailable = fs.existsSync(RELAY_PATH);

const desktopIdentity = {
  unimindId: UNIMIND_ID,
  device: 'desktop' as Device,
  deviceId: DESKTOP_DEVICE_ID,
};

interface RawPeer {
  ws: WsWebSocket;
  frames: unknown[];
}

let relay: ChildProcess | null = null;
let desktop: RawPeer | null = null;
let client: UnimindClient;
let toolRegistry: typeof ToolRegistrySingleton;
let desktopSeq = 0;

async function waitFor(fn: () => boolean, timeoutMs = 5000, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function waitForFrame(
  pred: (f: Record<string, unknown>) => boolean,
  timeoutMs = 5000,
  label = 'frame',
): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = (desktop?.frames ?? []).find((f) => pred(f as Record<string, unknown>));
    if (hit) return hit as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for frame: ${label}`);
}

function openRawPeer(): Promise<RawPeer> {
  return new Promise((resolve, reject) => {
    const ws = new WsWebSocket(RELAY_URL);
    const peer: RawPeer = { ws, frames: [] };
    const timer = setTimeout(() => reject(new Error('raw peer connect timed out')), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      ws.send(
        JSON.stringify({
          type: 'hello',
          identity: desktopIdentity,
          name: 'Test Desktop',
        }),
      );
      resolve(peer);
    });
    ws.on('message', (data) => {
      try {
        peer.frames.push(JSON.parse(data.toString()));
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/** Send a message as the desktop. Envelope seq increments per send. */
function sendMessage(payload: Parameters<typeof makeEnvelope>[1]): void {
  const msg = makeEnvelope(desktopIdentity, payload, ++desktopSeq);
  desktop?.ws.send(JSON.stringify({ type: 'message', message: msg }));
}

function waitForStdoutListening(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('relay did not start in time')), 10_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', () => {
      clearTimeout(timer);
      reject(new Error('relay exited early'));
    });
  });
}

beforeAll(async () => {
  // The client references the global WebSocket — give it the real one.
  vi.stubGlobal('WebSocket', WsWebSocket);

  // Identity must be in localStorage BEFORE the client singleton is built,
  // so reset the module registry and import fresh (imports are hoisted and
  // would otherwise construct the singleton with an empty identity).
  localStorage.setItem('gia:unimind:relayUrl', RELAY_URL);
  localStorage.setItem('gia:unimind:unimindId', UNIMIND_ID);
  localStorage.removeItem('gia:unimind:deviceId');
  vi.resetModules();

  relay = spawn('node', [RELAY_PATH], {
    env: { ...process.env, PORT: String(RELAY_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForStdoutListening(relay);

  const clientMod = await import('../unimindClient');
  client = clientMod.unimindClient;
  const registryMod = await import('../ToolRegistry');
  toolRegistry = registryMod.default;
});

afterAll(() => {
  client?.disconnect();
  desktop?.ws.close();
  relay?.kill('SIGTERM');
  vi.unstubAllGlobals();
});

describe.skipIf(!relayAvailable)('Unimind spine (mobile client ↔ relay ↔ desktop)', () => {
  it('pairs both devices and shares presence', async () => {
    expect(await client.connect()).toBe(true);

    desktop = await openRawPeer();

    // Mobile learns the desktop is a peer.
    await waitFor(() => client.getStatus().peers.some((p) => p.deviceId === DESKTOP_DEVICE_ID), 5000, 'mobile sees desktop peer');

    // Desktop sees the mobile in its peers broadcast.
    await waitForFrame(
      (f) => f.type === 'peers' && (f.peers as Array<{ device: string }>)?.some((p) => p.device === 'mobile'),
      5000,
      'desktop sees mobile peer',
    );

    // Desktop announces presence → mobile applies it.
    const presenceSpy = vi.fn();
    client.onPresence = presenceSpy;
    sendMessage({ type: 'presence', device: 'desktop', status: 'online' });
    await waitFor(() => presenceSpy.mock.calls.length > 0, 5000, 'onPresence fired');
    await waitFor(
      () => client.getStatus().peers.find((p) => p.deviceId === DESKTOP_DEVICE_ID)?.presence === 'online',
      5000,
      'desktop presence=online',
    );
  });

  it('routes chat in both directions', async () => {
    // Desktop → mobile
    const chatSpy = vi.fn();
    client.onChat = chatSpy;
    sendMessage({ type: 'chat', role: 'user', content: 'hi from the desktop' });
    await waitFor(() => chatSpy.mock.calls.length > 0, 5000, 'mobile onChat fired');
    const [peer, text] = chatSpy.mock.calls[0] as unknown as [UnimindPeer, string];
    expect(peer.deviceId).toBe(DESKTOP_DEVICE_ID);
    expect(text).toBe('hi from the desktop');

    // Mobile → desktop
    expect(client.sendChat('hello from the phone')).toBe(true);
    const out = await waitForFrame(
      (f) => {
        const m = (f as { message?: { payload: { type: 'chat'; content: string } } }).message;
        return m?.payload.type === 'chat' && m.payload.content === 'hello from the phone';
      },
      5000,
      'desktop receives mobile chat',
    );
    expect((out as { message: UnimindMessage }).message.envelope.device).toBe('mobile');
  });

  it('executes an action the desktop delegates to the mobile', async () => {
    toolRegistry.register({
      id: 'e2e_echo',
      name: 'e2e_echo',
      description: 'E2E test tool',
      schema: { type: 'object', properties: {} },
      execute: async (params: Record<string, unknown>) => ({ success: true, content: `echo:${JSON.stringify(params)}`, error: undefined }),
    });

    sendMessage({ type: 'action', target: 'mobile', capability: 'e2e_echo', params: { note: 'ping' }, requestId: 'req-1' });

    const res = await waitForFrame(
      (f) => {
        const m = (f as { message?: UnimindMessage }).message;
        return m?.payload.type === 'action' && m.payload.requestId === 'req-1' && m.payload.result !== undefined;
      },
      5000,
      'mobile returns action result',
    );
    const payload = (res as { message: UnimindMessage }).message.payload as { result: { success: boolean; content: string } };
    expect(payload.result.success).toBe(true);
    expect(payload.result.content).toBe('echo:{"note":"ping"}');
  });

  it('awaits a result when the mobile delegates an action to the desktop', async () => {
    const pending = client.requestAction(DESKTOP_DEVICE_ID, 'e2e_ping', { q: 42 });

    // Desktop receives the request.
    const req = await waitForFrame(
      (f) => {
        const m = (f as { message?: UnimindMessage }).message;
        return m?.payload.type === 'action' && m.payload.capability === 'e2e_ping' && m.payload.error === undefined && m.payload.result === undefined;
      },
      5000,
      'desktop receives action request',
    );
    const reqPayload = (req as { message: UnimindMessage }).message.payload as { requestId: string; params: Record<string, unknown> };
    expect(reqPayload.params).toEqual({ q: 42 });

    // Desktop answers (result is passed through verbatim by the requester).
    sendMessage({
      type: 'action',
      target: 'mobile',
      capability: 'e2e_ping',
      params: { q: 42 },
      requestId: reqPayload.requestId,
      result: { success: true, content: 'pong' },
    });

    await expect(pending).resolves.toEqual({ success: true, content: { success: true, content: 'pong' } });
  });
});
