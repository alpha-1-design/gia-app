import { useGiaStore } from '../store/useGiaStore';
import type { TaskItem } from '../store/useGiaStore';

// Coalesces high-frequency stream updates (one per token) into a single
// flush per frame, so React re-renders at most once per frame instead of
// once per token. Uses a dual-strategy: rAF for visual sync, + immediate
// microtask fallback via MessageChannel so text appears promptly even when
// tool execution or synchronous work delays the next rAF.

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
}

const pending = new Map<string, FlushEntry>();

function doFlush(entry: FlushEntry, key: string): void {
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
    // will read them.
    existing.content = content;
    existing.thoughts = thoughts;
    if (tasks) existing.tasks = tasks;
    return;
  }
  const entry: FlushEntry = { rafHandle: 0, sessionId, asstId, content, thoughts, tasks, isAborted };
  // rAF flush: keeps UI in sync with display refresh
  const rafFlush = () => doFlush(entry, key);
  entry.rafHandle = rafSupported ? requestAnimationFrame(rafFlush) : 0;
  // Immediate microtask flush via MessageChannel — fires as soon as the
  // current synchronous batch yields, without waiting for the next rAF.
  // This ensures text generated during tool execution appears in the UI
  // promptly, not only after all tools complete.
  const mc = new MessageChannel();
  mc.port1.onmessage = () => {
    if (pending.get(key) === entry) {
      cancelAnimationFrame(entry.rafHandle);
      doFlush(entry, key);
    }
  };
  mc.port2.postMessage(null);
  pending.set(key, entry);
}

export function streamCancel(key: string): void {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);
  if (rafSupported) cancelAnimationFrame(entry.rafHandle);
}
