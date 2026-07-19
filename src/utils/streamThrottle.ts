import { useGiaStore } from '../store/useGiaStore';
import type { TaskItem } from '../store/useGiaStore';

// Coalesces high-frequency stream updates (one per token) into a single
// flush per frame, so React re-renders at most once per frame instead of
// once per token. Uses a dual-strategy: rAF for visual sync, + a macrotask
// fallback via a single shared MessageChannel so text appears promptly even
// when tool execution or synchronous work delays the next rAF.
//
// A single shared MessageChannel is used as a scheduler (created once) rather
// than one per token — creating a MessageChannel per token leaked ports and
// let a stale channel cancel a newer rAF.

const rafSupported =
  typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function';

interface FlushEntry {
  rafHandle: number;
  sessionId: string;
  asstId: string;
  content: string;
  thoughts: string | undefined;
  tasks: TaskItem[] | null;
  isAborted: () => boolean;
  flushed: boolean;
}

const pending = new Map<string, FlushEntry>();

// A single macrotask scheduler. MessageChannel is preferred over
// queueMicrotask because it yields to the event loop (so it doesn't run
// before the next paint), keeping the rAF path as the primary visual sync.
const scheduler = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
let microScheduled = false;

function runMicroFlush(): void {
  microScheduled = false;
  // Snapshot to avoid mutation-during-iteration if a flush triggers a push.
  for (const [key, entry] of Array.from(pending)) {
    if (pending.get(key) !== entry) continue; // superseded by a newer entry
    if (rafSupported) cancelAnimationFrame(entry.rafHandle);
    doFlush(entry, key);
  }
}

function scheduleMicro(): void {
  if (microScheduled) return;
  microScheduled = true;
  if (scheduler) scheduler.port2.postMessage(1);
  else queueMicrotask(runMicroFlush);
}

if (scheduler) scheduler.port1.onmessage = runMicroFlush;

function doFlush(entry: FlushEntry, key: string): void {
  if (entry.flushed) return; // idempotent — rAF and microtask may both fire
  entry.flushed = true;
  pending.delete(key);
  if (entry.isAborted()) return;
  const store = useGiaStore.getState();
  store.updateMessage(entry.sessionId, entry.asstId, entry.content, entry.thoughts);
  if (entry.tasks) {
    store.updateMessageTasks(entry.sessionId, entry.asstId, entry.tasks);
    entry.tasks = null;
  }
}

export function streamPush(
  key: string,
  sessionId: string,
  asstId: string,
  content: string,
  thoughts: string | undefined,
  tasks: TaskItem[] | null,
  isAborted: () => boolean,
): void {
  const existing = pending.get(key);
  if (existing) {
    // Already scheduled — just capture latest values; both rAF + microtask
    // will read them. Allow a fresh flush cycle for the updated content.
    existing.content = content;
    existing.thoughts = thoughts;
    if (tasks) existing.tasks = tasks;
    existing.flushed = false;
    return;
  }
  const entry: FlushEntry = {
    rafHandle: 0,
    sessionId,
    asstId,
    content,
    thoughts,
    tasks,
    isAborted,
    flushed: false,
  };
  // rAF flush: keeps UI in sync with display refresh.
  if (rafSupported) entry.rafHandle = requestAnimationFrame(() => doFlush(entry, key));
  pending.set(key, entry);
  // Immediate macrotask fallback — fires as soon as the current synchronous
  // batch yields, without waiting for the next rAF. This ensures text
  // generated during tool execution appears in the UI promptly, not only
  // after all tools complete.
  scheduleMicro();
}

export function streamCancel(key: string): void {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);
  if (rafSupported) cancelAnimationFrame(entry.rafHandle);
}
