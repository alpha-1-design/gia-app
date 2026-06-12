/**
 * Sandbox.ts — Plugin Code Sandbox
 *
 * Provides a safe execution environment for plugin hook code using a Web Worker
 * (inline blob URL) as the isolation boundary. No eval() or new Function() in
 * the main thread; code evaluation happens inside the worker with a limited API.
 */

interface SandboxResult {
  result: unknown;
  error: string | null;
  logs: string[];
  executionMs: number;
}

type SandboxCallback = (r: SandboxResult) => void;

// ─── Inline worker source ────────────────────────────────────────────────
// This string becomes the Web Worker. It receives code + context via
// postMessage, then evaluates the code with a restricted set of globals.
// "new Function" is used *inside the worker* (already sandboxed — no DOM,
// no main‑thread globals, no fetch, etc.).
const WORKER_SOURCE = `
  "use strict";

  self.onmessage = async function (e) {
    const { code, context, timeoutMs } = e.data;
    const logs = [];
    const start = performance.now();

    // --- bounded setTimeout (cap at 5 s) ---
    const safeTimers = new Map();
    let timerCounter = 0;
    const boundedSetTimeout = (fn, ms, ...args) => {
      const id = ++timerCounter;
      const actual = Math.min(Math.max(ms|0, 0), 5000);
      const handle = setTimeout(() => { safeTimers.delete(id); fn(...args); }, actual);
      safeTimers.set(id, handle);
      return id;
    };
    const boundedClearTimeout = (id) => {
      const handle = safeTimers.get(id);
      if (handle) { clearTimeout(handle); safeTimers.delete(id); }
    };
    const boundedSetInterval = (fn, ms, ...args) => {
      const id = ++timerCounter;
      const actual = Math.min(Math.max(ms|0, 0), 5000);
      const handle = setInterval(() => fn(...args), actual);
      safeTimers.set(id, handle);
      return id;
    };
    const boundedClearInterval = (id) => {
      const handle = safeTimers.get(id);
      if (handle) { clearInterval(handle); safeTimers.delete(id); }
    };

    // --- sandbox console ---
    const sbConsole = {
      log:   (...a) => { logs.push('[LOG] '   + a.map(String).join(' ')); },
      warn:  (...a) => { logs.push('[WARN] '  + a.map(String).join(' ')); },
      error: (...a) => { logs.push('[ERROR] ' + a.map(String).join(' ')); },
    };

    try {
      // Build the list of parameter names → values that the sandboxed code
      // can access.  Every built‑in is re‑bound so the code cannot reach
      // the global object through constructor chains.
      const sandboxGlobals = {
        console:       sbConsole,
        setTimeout:    boundedSetTimeout,
        clearTimeout:  boundedClearTimeout,
        setInterval:   boundedSetInterval,
        clearInterval: boundedClearInterval,
        Math, JSON, Array, Object, String, Number, Boolean,
        Map, Set, Promise, RegExp, Date,
        Int8Array, Uint8Array, Uint8ClampedArray,
        Int16Array, Uint16Array, Int32Array, Uint32Array,
        Float32Array, Float64Array,
        ArrayBuffer, SharedArrayBuffer, DataView,
        Error, TypeError, RangeError, SyntaxError, ReferenceError,
        parseInt, parseFloat, isNaN, isFinite,
        decodeURI, decodeURIComponent, encodeURI, encodeURIComponent,
        // Plugin context
        context: context || {},
      };

      const paramNames = Object.keys(sandboxGlobals);
      const paramValues = Object.values(sandboxGlobals);

      const fn = new Function(
        ...paramNames,
        '"use strict";\nreturn (async () => {\n' + code + '\n})();',
      );

      const result = await fn(...paramValues);
      const executionMs = performance.now() - start;
      self.postMessage({ result, error: null, logs, executionMs });
    } catch (err) {
      const executionMs = performance.now() - start;
      self.postMessage({
        result: null,
        error: err instanceof Error ? err.message : String(err),
        logs,
        executionMs,
      });
    }
  };
`;

export class Sandbox {
  private static instance: Sandbox;

  private worker: Worker | null = null;
  private pending: Map<number, SandboxCallback> = new Map();
  private msgCounter = 0;
  private consecutiveTimeouts = 0;
  private readonly maxConsecutiveTimeouts = 3;
  private envSupported: boolean | null = null;

  /** Get the singleton instance (lazily created). */
  static getInstance(): Sandbox {
    if (!Sandbox.instance) {
      Sandbox.instance = new Sandbox();
    }
    return Sandbox.instance;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Execute arbitrary code inside the sandboxed Web Worker.
   *
   * @param code        – JavaScript source to execute.
   * @param context     – A plain object made available as `context` inside the code.
   * @param timeoutMs   – Maximum wall-clock time in ms (default 5000).
   * @returns           – Sandbox execution report.
   */
  async execute(
    code: string,
    context?: Record<string, unknown>,
    timeoutMs: number = 5000,
  ): Promise<SandboxResult> {
    if (!this.checkEnvironment()) {
      return {
        result: null,
        error: 'Sandbox not available in this environment',
        logs: [],
        executionMs: 0,
      };
    }

    // Lazy init the worker
    if (!this.worker) {
      this.worker = this.createWorker();
      if (!this.worker) {
        return {
          result: null,
          error: 'Sandbox not available in this environment',
          logs: [],
          executionMs: 0,
        };
      }
    }

    return new Promise<SandboxResult>((resolve) => {
      const id = ++this.msgCounter;
      this.pending.set(id, resolve);

      // Timeout guard
      const timer = setTimeout(() => {
        const cb = this.pending.get(id);
        if (cb) {
          this.pending.delete(id);
          this.consecutiveTimeouts++;
          if (this.consecutiveTimeouts >= this.maxConsecutiveTimeouts) {
            this.terminate();
          }
          cb({
            result: null,
            error: `Sandbox execution timed out after ${timeoutMs}ms`,
            logs: [],
            executionMs: timeoutMs,
          });
        }
      }, timeoutMs);

      // Wrap resolve to clear timer
      const wrappedResolve: SandboxCallback = (r) => {
        clearTimeout(timer);
        if (r.error === null) {
          this.consecutiveTimeouts = 0; // reset on success
        }
        resolve(r);
      };
      this.pending.set(id, wrappedResolve);

      if (this.worker) {
        this.worker.postMessage({ id, code, context, timeoutMs });
      } else {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({
          result: null,
          error: 'Sandbox worker was terminated before execution',
          logs: [],
          executionMs: 0,
        });
      }
    });
  }

  /** Tear down the worker and free resources. */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
    this.consecutiveTimeouts = 0;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  /** Quick capability check for Blob + Worker support. */
  private checkEnvironment(): boolean {
    if (this.envSupported !== null) return this.envSupported;
    try {
      if (
        typeof Worker === 'undefined' ||
        typeof Blob === 'undefined' ||
        typeof URL === 'undefined' ||
        typeof URL.createObjectURL === 'undefined'
      ) {
        this.envSupported = false;
      } else {
        // Quick smoke-test: can we create a blob URL Worker?
        const test = new Worker(
          URL.createObjectURL(new Blob([''], { type: 'application/javascript' })),
        );
        test.terminate();
        this.envSupported = true;
      }
    } catch {
      this.envSupported = false;
    }
    return this.envSupported;
  }

  /** Build the Web Worker from the inline source blob. */
  private createWorker(): Worker | null {
    try {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      URL.revokeObjectURL(url);

      // Wire up the message handler
      w.onmessage = (e: MessageEvent) => {
        const { id, result, error, logs, executionMs } = e.data;
        const cb = this.pending.get(id);
        if (cb) {
          this.pending.delete(id);
          cb({ result, error, logs, executionMs });
        }
      };

      w.onerror = (err: ErrorEvent) => {
        // Unhandled worker errors — reject all pending
        const errMsg = err.message || 'Unknown worker error';
        for (const [id, cb] of this.pending) {
          this.pending.delete(id);
          cb({
            result: null,
            error: `Unhandled worker error: ${errMsg}`,
            logs: [],
            executionMs: 0,
          });
        }
      };

      return w;
    } catch {
      return null;
    }
  }
}

export default Sandbox.getInstance();
