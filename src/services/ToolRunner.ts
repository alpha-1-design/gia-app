/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ToolRunner.ts
 *
 * Universal wrapper that all tool calls go through.
 * - Auto-queues calls for offline execution when the network is unavailable.
 * - Returns a structured response: either the result or an error shape.
 */

import { enqueue, isOnline, processQueue } from './OfflineQueue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolResult {
  /** The actual payload returned by the tool, if successful. */
  data?: any;
  /** True when the call was queued for offline replay rather than executed. */
  queued?: boolean;
  /** Human-readable message for the caller. */
  message?: string;
  /** Error details if the call failed. */
  error?: string;
  /** Machine-readable error code. */
  code?: string;
}

export interface ToolRunnerOptions {
  /**
   * When true (default), offline calls are automatically queued.
   * Set false to throw immediately instead of queueing.
   */
  offlineQueue?: boolean;
  /**
   * Maximum number of retry attempts for offline-queued calls.
   * Defaults to 3 when not specified.
   */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Default executor — plug in your actual dispatch logic at import time.
// ---------------------------------------------------------------------------

/**
 * The function that actually invokes the tool.
 * Replace `setDefaultExecutor` at app initialisation to wire in your real
 * tool dispatch pipeline.
 */
let defaultExecutor:
  | ((tool: string, args: any) => Promise<any>)
  | null = null;

/**
 * Override the default executor used by runTool.
 */
export function setDefaultExecutor(
  fn: (tool: string, args: any) => Promise<any>,
): void {
  defaultExecutor = fn;
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Execute a tool call through the unified runner.
 *
 * When the device is offline and `offlineQueue` is not explicitly set to
 * false, the call is enqueued and a `{ queued: true }` response is returned
 * immediately.  The queue is flushed automatically when connectivity returns
 * (see `attachAutoFlush` in OfflineQueue.ts).
 *
 * @param tool  - Name of the tool to invoke.
 * @param args  - Arguments to pass to the tool.
 * @param options - Control offline-queue behaviour.
 */
export async function runTool(
  tool: string,
  args: any,
  options?: ToolRunnerOptions,
): Promise<ToolResult> {
  const allowQueue = options?.offlineQueue !== false;

  // --- Offline ➜ queue ---------------------------------------------------
  if (!isOnline() && allowQueue) {
    const id = enqueue(tool, args, options?.maxRetries);
    return {
      queued: true,
      message: `Offline: queued '${tool}' for later execution (id=${id})`,
    };
  }

  // --- Online (or queue disabled) ➜ execute ------------------------------
  if (!defaultExecutor) {
    return {
      error: 'No executor configured. Call setDefaultExecutor() first.',
      code: 'EXECUTOR_MISSING',
    };
  }

  try {
    const result = await defaultExecutor(tool, args);
    return { data: result };
  } catch (err: any) {
    const message =
      err?.message ?? err?.toString?.() ?? 'Unknown tool error';

    // One last attempt: if offline and queueing is allowed, enqueue anyway.
    if (!isOnline() && allowQueue) {
      const id = enqueue(tool, args, options?.maxRetries);
      return {
        queued: true,
        message: `Call failed and device is offline: queued '${tool}' (id=${id})`,
      };
    }

    return {
      error: message,
      code: err?.code ?? 'TOOL_ERROR',
    };
  }
}

/**
 * Convenience — flush the offline queue using the configured default executor.
 * Safe to call when no executor is set (no-op).
 */
export async function flushOfflineQueue(): Promise<void> {
  if (!defaultExecutor) return;
  await processQueue(defaultExecutor);
}
