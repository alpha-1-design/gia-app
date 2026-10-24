import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, MessageSquare, Minus, Power, Send } from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import GiaBrain from '../services/GiaBrain';
import { genId } from '../utils/id';
import { extractSuggestions, stripSuggestionScaffolding } from '../utils/suggestions';
import { useShallow } from 'zustand/react/shallow';

/**
 * Floating chat HUD.
 *
 * It is not an always-on orb: the user explicitly turns it on from the header
 * (or Settings), and it can be dismissed to a small edge tab. Because it lives
 * in the app shell it keeps working while you move between modules, and it
 * writes into the same active session as the full Chat screen.
 */
const FloatingHud: React.FC = () => {
  const { enabled, setShowHud, sessions, activeSessionId, generationActive, setModule, createSession, addMessage, updateMessage } = useGiaStore(useShallow(s => ({
    enabled: s.showHud,
    setShowHud: s.setShowHud,
    sessions: s.sessions,
    activeSessionId: s.activeSessionId,
    generationActive: s.generationState.active,
    setModule: s.setModule,
    createSession: s.createSession,
    addMessage: s.addMessage,
    updateMessage: s.updateMessage,
  })));

  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { if (enabled) setOpen(true); }, [enabled]);

  const messages = useMemo(() => {
    const session = sessions.find(s => s.id === activeSessionId);
    return (session?.messages ?? [])
      .map(m => m.message)
      .filter(m => !m.thinking && m.content && !m.error)
      .slice(-8);
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, streamingText, open]);

  useEffect(() => () => {
    if (flushRef.current) clearTimeout(flushRef.current);
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || generationActive) return;

    const sessionId = activeSessionId ?? createSession();
    const now = Date.now();
    const userMsg = { id: genId(), role: 'user' as const, content: text, timestamp: now };
    const asstId = genId();
    addMessage(sessionId, userMsg);
    addMessage(sessionId, { id: asstId, role: 'assistant', content: '', timestamp: now + 1, thinking: true });

    setInput('');
    setSending(true);
    setStreamingText('');

    const history = useGiaStore.getState().sessions
      .find(s => s.id === sessionId)?.messages
      .map(m => m.message)
      .filter(m => m.id !== asstId && !m.thinking && m.content)
      .slice(-12)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) ?? [];

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let accumulated = '';

    const flush = () => {
      flushRef.current = null;
      setStreamingText(stripSuggestionScaffolding(accumulated));
    };

    try {
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        checkpointKey: `hud:${sessionId}:${asstId}`,
        messageId: asstId,
        prompt: text,
        history,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          if (accumulated.includes('```tool')) return;
          if (!flushRef.current) flushRef.current = setTimeout(flush, 80);
        },
      });
      if (ctrl.signal.aborted) return;
      updateMessage(sessionId, asstId, extractSuggestions(res.text || accumulated).content);
    } catch (e) {
      if (!ctrl.signal.aborted) {
        updateMessage(sessionId, asstId, e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      if (flushRef.current) { clearTimeout(flushRef.current); flushRef.current = null; }
      setStreamingText('');
      setSending(false);
      abortRef.current = null;
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess => sess.id === sessionId
          ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
          : sess),
      }));
    }
  }, [input, sending, generationActive, activeSessionId, createSession, addMessage, updateMessage]);

  if (!enabled) return null;

  const busy = sending || generationActive;

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          key="hud"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          aria-label="GIA floating chat"
          className="fixed z-[90] flex flex-col overflow-hidden left-3 right-3 sm:left-auto sm:right-4"
          style={{
            bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
            width: 'min(100% - 1.5rem, 380px)',
            maxHeight: 'min(62vh, 520px)',
            background: 'var(--gia-surface)',
            border: '1px solid var(--gia-border-2)',
            borderRadius: 12,
            boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
          }}
        >
          <header className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: busy ? 'var(--gia-text)' : 'var(--gia-muted-2)' }} />
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--gia-text)' }}>GIA</span>
            <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{busy ? 'working' : 'here'}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => { setModule('chat'); setOpen(false); }}
                className="p-1.5 rounded-md tap-feedback"
                style={{ color: 'var(--gia-muted)' }}
                title="Open full chat"
                aria-label="Open full chat"
              >
                <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md tap-feedback"
                style={{ color: 'var(--gia-muted)' }}
                title="Minimize HUD"
                aria-label="Minimize HUD"
              >
                <Minus size={13} />
              </button>
              <button
                onClick={() => setShowHud(false)}
                className="p-1.5 rounded-md tap-feedback"
                style={{ color: 'var(--gia-muted)' }}
                title="Turn HUD off"
                aria-label="Turn HUD off"
              >
                <Power size={12} />
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5" style={{ minHeight: 96 }}>
            {messages.length === 0 && !streamingText && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                Ask GIA anything. This window stays with you when you switch modules.
              </p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="text-[11.5px] leading-relaxed px-2.5 py-1.5 max-w-[88%] whitespace-pre-wrap break-words"
                  style={m.role === 'user'
                    ? { background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border-2)', color: 'var(--gia-text)', borderRadius: '9px 9px 2px 9px' }
                    : { background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)', borderRadius: '2px 9px 9px 9px' }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="text-[11.5px] leading-relaxed px-2.5 py-1.5 max-w-[88%] whitespace-pre-wrap break-words"
                  style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)', borderRadius: '2px 9px 9px 9px' }}>
                  {streamingText || 'Thinking…'}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-center gap-1.5 p-2 shrink-0"
            style={{ borderTop: '1px solid var(--gia-border)' }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={generationActive ? 'GIA is busy in chat…' : 'Message GIA…'}
              disabled={generationActive || sending}
              className="flex-1 min-w-0 bg-transparent outline-none text-[12px] px-2 py-1.5"
              style={{ color: 'var(--gia-text)' }}
              aria-label="Message GIA from the HUD"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="p-1.5 rounded-md tap-feedback disabled:opacity-30"
              style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border-2)' }}
              aria-label="Send"
            >
              <Send size={12} />
            </button>
          </form>
        </motion.section>
      ) : (
        <motion.button
          key="hud-tab"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
          className="fixed z-[90] flex items-center gap-1.5 px-3 py-2 tap-feedback"
          style={{
            right: 12,
            bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
            background: 'var(--gia-surface)',
            border: '1px solid var(--gia-border-2)',
            borderRadius: 9,
            color: 'var(--gia-text)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
          aria-label="Open GIA HUD"
        >
          <MessageSquare size={13} />
          <span className="text-[10px] font-semibold">GIA</span>
          {busy && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />}
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default FloatingHud;
