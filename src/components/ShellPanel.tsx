/**
 * ShellPanel — a command shell for the on-device Alpine Linux environment.
 *
 * Runs one command at a time inside proot (same sandbox the AI uses), streams
 * output live, remembers the working directory between commands, and can stop
 * a running command. It is NOT a full PTY: programs that need the whole screen
 * or live keystrokes (nano, vim, top, python REPL) won't work here — the
 * native layer has no stdin/PTY channel yet.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Square, CornerDownLeft } from 'lucide-react';
import terminalService from '../services/TerminalService';
import { wrapCommand, parseShellOutput, capScrollback } from '../utils/shellOutput';

const POLL_MS = 150;
const START_DIR = '/workspace';

interface Entry { id: number; cmd: string; cwd: string; out: string; exit: number | null; running: boolean }

export default function ShellPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState(START_DIR);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const sessionRef = useRef<string | null>(null);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const available = terminalService.isAvailable();

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [entries]);
  useEffect(() => () => {
    // Don't leave a command running if the user leaves the tab.
    if (sessionRef.current) void terminalService.kill(sessionRef.current).catch(() => undefined);
  }, []);

  const patch = useCallback((id: number, p: Partial<Entry>) => {
    setEntries(list => list.map(e => (e.id === id ? { ...e, ...p } : e)));
  }, []);

  const run = useCallback(async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd || busy) return;
    setInput('');
    setHistIdx(-1);
    setHistory(h => [cmd, ...h.filter(x => x !== cmd)].slice(0, 50));

    if (cmd === 'clear') { setEntries([]); return; }

    const id = ++idRef.current;
    setEntries(list => [...list, { id, cmd, cwd, out: '', exit: null, running: true }]);
    setBusy(true);
    cancelledRef.current = false;

    let rawOut = '';
    try {
      const { sessionId } = await terminalService.spawn(wrapCommand(cmd), cwd);
      sessionRef.current = sessionId;
      for (;;) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const r = await terminalService.readOutput(sessionId);
        rawOut += r.output;
        const { text, cwd: newCwd } = parseShellOutput(rawOut);
        patch(id, { out: capScrollback(text) });
        if (!r.running || r.gone) {
          if (newCwd) setCwd(newCwd);
          patch(id, { running: false, exit: cancelledRef.current ? 130 : r.exitCode });
          break;
        }
      }
    } catch (err) {
      patch(id, { running: false, exit: -1, out: `${err instanceof Error ? err.message : String(err)}` });
    } finally {
      sessionRef.current = null;
      setBusy(false);
    }
  }, [busy, cwd, patch]);

  const stop = useCallback(async () => {
    if (!sessionRef.current) return;
    cancelledRef.current = true;
    await terminalService.kill(sessionRef.current).catch(() => undefined);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      if (next >= 0 && history[next] !== undefined) { setHistIdx(next); setInput(history[next]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next);
      setInput(next >= 0 ? history[next] : '');
    }
  };

  if (!available) {
    return (
      <p className="text-xs opacity-60">
        The on-device shell needs the GIA Android app. It isn't available in the browser.
      </p>
    );
  }

  const prompt = `root@gia:${cwd}#`;

  return (
    <div className="flex flex-col gap-2 h-full min-h-[60vh]">
      <div
        className="flex-1 overflow-y-auto rounded-xl p-3 font-mono text-[11px] leading-relaxed"
        style={{ background: '#07070c', border: '1px solid rgba(255,255,255,0.08)', color: '#d4d4d8' }}
        onClick={() => document.getElementById('gia-shell-input')?.focus()}
      >
        {entries.length === 0 && (
          <p className="opacity-50">
            Alpine Linux shell. Try <span className="text-emerald-400">ls</span>, <span className="text-emerald-400">python3 --version</span> or <span className="text-emerald-400">apk add nano</span>.
            Interactive full-screen programs (nano, vim, top) aren't supported yet.
          </p>
        )}
        {entries.map(e => (
          <div key={e.id} className="mb-2">
            <div><span className="text-emerald-400">root@gia:{e.cwd}#</span> {e.cmd}</div>
            {e.out && <pre className="whitespace-pre-wrap break-words m-0 font-mono">{e.out}</pre>}
            {!e.running && e.exit !== null && e.exit !== 0 && (
              <div className="text-red-400">exit {e.exit}</div>
            )}
            {e.running && <div className="opacity-50">running…</div>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#07070c', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="font-mono text-[11px] text-emerald-400 shrink-0 max-w-[45%] truncate">{prompt}</span>
        <input
          id="gia-shell-input"
          className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[12px] text-white"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onKeyUp={e => { if (e.key === 'Enter') void run(input); }}
          placeholder={busy ? 'running…' : 'type a command'}
          disabled={busy}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-label="Shell command"
        />
        {busy ? (
          <button onClick={() => void stop()} aria-label="Stop command" className="p-1.5 rounded bg-red-500/20 text-red-400">
            <Square size={14} />
          </button>
        ) : (
          <button onClick={() => void run(input)} disabled={!input.trim()} aria-label="Run command" className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 disabled:opacity-30">
            <CornerDownLeft size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
