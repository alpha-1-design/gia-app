/**
 * Integration smoke test for the dev-mode sandbox server.
 *
 * Spawns the real server as a child process and asserts:
 *  - it boots and reports health,
 *  - unknown routes 404,
 *  - CORS preflight works,
 *  - sandbox routes are gated behind the backend (503 when the rootfs is
 *    missing) — the "refusing unsafe host fallback" guarantee. Without this,
 *    a missing rootfs would fall through to running commands on the host.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';

const PORT = 3400 + (process.pid % 400);
// vitest root is the repo root, so cwd is stable here.
const SERVER = path.join(process.cwd(), 'server', 'sandbox-server.cjs');
const BASE = `http://127.0.0.1:${PORT}`;

let child;
let health;

describe('sandbox-server.cjs', () => {
  beforeAll(async () => {
    child = spawn(process.execPath, [SERVER, `--port=${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    child.stdout.on('data', d => { logs += d; });
    child.stderr.on('data', d => { logs += d; });

    const deadline = Date.now() + 30000;
    for (;;) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) { health = await r.json(); break; }
      } catch { /* not listening yet */ }
      if (Date.now() > deadline) throw new Error(`server never became healthy:\n${logs}`);
      await new Promise(r => setTimeout(r, 250));
    }
  }, 40000);

  afterAll(() => {
    child?.kill('SIGKILL');
  });

  it('GET /health reports backend state and workspace paths', () => {
    expect(typeof health.ok).toBe('boolean');
    expect(health.backendReady).toBe(health.ok);
    expect(['proot', 'docker']).toContain(health.backend);
    expect(health.workspace).toMatch(/sandbox-workspace$/);
    expect(health.rootfs === null || typeof health.rootfs === 'string').toBe(true);
  });

  it('404s unknown routes with the route key in the error', async () => {
    const r = await fetch(`${BASE}/nope`);
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body.error).toBe('Not found: GET /nope');
  });

  it('answers CORS preflight with 204 and allow headers', async () => {
    const r = await fetch(`${BASE}/exec`, { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(r.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('gates sandbox routes behind the backend — 503 instead of running on the host', async () => {
    const list = await fetch(`${BASE}/fs/list?path=/workspace`);
    const exec = await fetch(`${BASE}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'id' }),
    });

    if (!health.ok) {
      // Rootfs unavailable: nothing may reach the host shell.
      expect(list.status).toBe(503);
      expect((await list.json()).error).toContain('Sandbox unavailable');
      expect(exec.status).toBe(503);
      expect((await exec.json()).error).toContain('Sandbox unavailable');
    } else {
      expect(list.status).not.toBe(503);
      expect(exec.status).not.toBe(503);
    }
  });

  it('POST /exec validates the body when the backend is up', async () => {
    if (!health.ok) return; // validation runs after the backend gate
    const r = await fetch(`${BASE}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notcommand: true }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain('command is required');
  });
});
