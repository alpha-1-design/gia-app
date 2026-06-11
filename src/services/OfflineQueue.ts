/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * OfflineQueue.ts
 *
 * A persistent offline queue that stores tool calls when the network is
 * unavailable and replays them in FIFO order once connectivity is restored.
 *
 * Persistence uses localStorage (single JSON key `gia-offline-queue`).
 * Browser environments only — fails gracefully on non-browser runtimes.
 */

export interface QueuedCall {
  id: string;
  tool: string;
  args: any;
  createdAt: number;
  maxRetries: number;
  retryCount: number;
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gia-offline-queue';

function isStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function readQueue(): QueuedCall[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedCall[];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedCall[]): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Failed to persist queue:', e);
  }
}

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

let _eventListenerAttached = false;

/**
 * Enqueue a new tool call. Returns the unique id assigned to the call.
 */
export function enqueue(
  tool: string,
  args: any,
  maxRetries: number = 3,
): string {
  const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const call: QueuedCall = {
    id,
    tool,
    args,
    createdAt: Date.now(),
    maxRetries,
    retryCount: 0,
    lastError: null,
  };

  const queue = readQueue();
  queue.push(call);
  writeQueue(queue);

  return id;
}

/**
 * Remove a specific call from the queue by id.
 */
export function dequeue(id: string): QueuedCall | null {
  const queue = readQueue();
  const index = queue.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const [removed] = queue.splice(index, 1);
  writeQueue(queue);
  return removed ?? null;
}

/**
 * Process (replay) every queued call in FIFO order.
 *
 * Calls that succeed are removed. Calls that fail have their retryCount
 * incremented; if retryCount >= maxRetries the call is removed regardless.
 * The caller is expected to provide the actual `executor` — a function that
 * performs the tool call and returns a promise.
 *
 * @param executor - Function that actually runs the tool call.
 *   Receives (tool, args) and must reject on failure.
 */
export async function processQueue(
  executor: (tool: string, args: any) => Promise<any>,
): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedCall[] = [];

  for (const call of queue) {
    try {
      await executor(call.tool, call.args);
      // Success — drop the call
    } catch (err: any) {
      const errorMessage =
        err?.message ?? err?.toString?.() ?? 'Unknown error';
      call.retryCount += 1;
      call.lastError = errorMessage;

      if (call.retryCount < call.maxRetries) {
        remaining.push(call);
      }
      // else drop — exhausted retries
    }
  }

  writeQueue(remaining);
}

/**
 * Return a copy of the current queue (without modifying it).
 */
export function getQueue(): QueuedCall[] {
  return [...readQueue()];
}

/**
 * Clear the entire queue.
 */
export function clear(): void {
  writeQueue([]);
}

/**
 * Return summary statistics about the queue.
 */
export function getStats(): {
  total: number;
  pending: number;
  failed: number;
  completedRetries: number;
} {
  const queue = readQueue();
  return {
    total: queue.length,
    pending: queue.length,
    failed: queue.filter((c) => c.lastError !== null).length,
    completedRetries: queue.reduce((sum, c) => sum + c.retryCount, 0),
  };
}

// ---------------------------------------------------------------------------
// Connectivity helper
// ---------------------------------------------------------------------------

/**
 * Whether the browser currently reports being online.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Attach an event listener that automatically flushes the queue when the
 * browser transitions back to online. Safe to call multiple times — the
 * listener is only attached once.
 *
 * @param executor - Same signature as processQueue's executor.
 */
export function attachAutoFlush(
  executor: (tool: string, args: any) => Promise<any>,
): void {
  if (_eventListenerAttached) return;
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    console.info('[OfflineQueue] Back online — flushing queue');
    try {
      await processQueue(executor);
    } catch (err) {
      console.error('[OfflineQueue] Auto-flush failed:', err);
    }
  });

  _eventListenerAttached = true;
}
