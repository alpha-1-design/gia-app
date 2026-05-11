import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, AlertCircle, Plus, History, Trash2,
  Paperclip, X, Download, Globe, Image as ImageIcon,
  Brain, ChevronDown, Sparkles, GraduationCap, Code2,
  BookOpen, Zap, Undo2, Search, RotateCcw, Headphones,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore, Message } from '../store/useGiaStore';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import MessageContextMenu from '../components/MessageContextMenu';
import AmbientInput from '../components/AmbientInput';
import PDFService from '../services/PDFService';
import { useVoiceControl } from '../hooks/useVoiceControl';

const genId = () => Math.random().toString(36).slice(2, 10);

type Attachment = { name: string; type: string; content: string; preview?: string };

const formatTimeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const QUICK_STARTS = [
  { icon: GraduationCap, label: 'Exam Prep', prompt: 'Quiz me on WASSCE past questions for', color: '#a855f7' },
  { icon: BookOpen, label: 'BECE Prep', prompt: 'Help me study for BECE — topic:', color: '#3b82f6' },
  { icon: Code2, label: 'Code Help', prompt: 'Explain and fix this code:', color: '#ec4899' },
  { icon: Sparkles, label: 'Summarize URL', prompt: 'Summarize this URL: https://', color: '#10b981' },
  { icon: Zap, label: 'Plan My Week', prompt: 'Help me plan my study week. My exams are:', color: '#f59e0b' },
];

const ChatModule: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [extThinking, setExtThinking] = useState(false);
  const [handsOff, setHandsOff] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [undoMsg, setUndoMsg] = useState<{ id: string; sessionId: string; backup: any[] } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    sessions, activeSessionId, createSession, setActiveSession,
    addMessage, updateMessage, updateSessionTitle, deleteSession,
    forkSession, clearSession, setModule, getActiveSession, userProfile,
    setIntentState, addNotification,
  } = useGiaStore();

  const { providers, activeProvider } = useProviderStore();
  const providerLabel = PROVIDER_DEFAULTS[activeProvider]?.label ?? activeProvider;
  const providerConnected = providers[activeProvider]?.enabled ?? false;
  const activeModel = providers[activeProvider]?.model ?? '';

  const wakeWordRef = useRef(localStorage.getItem('gia-wake-word') || 'hey gia');
  const keepListeningRef = useRef(localStorage.getItem('gia-keep-listening') !== 'false');

  const handleWakeWord = useCallback((transcript: string) => {
    const ww = localStorage.getItem('gia-wake-word') || 'hey gia';
    const query = transcript.replace(new RegExp(ww, 'i'), '').trim();
    if (query) {
      setInput(query);
      addNotification('Wake word detected');
    }
  }, [addNotification]);

  const voiceControl = useVoiceControl({
    wakeWord: wakeWordRef.current,
    onWakeWord: handleWakeWord,
    keepListening: keepListeningRef.current,
    autoStopAfter: 120000,
  });
  

  const activeSession = getActiveSession();
  const messages = activeSession?.messages ?? [];

  useEffect(() => { if (!activeSessionId) createSession(); }, []);

  useEffect(() => {
    return () => { if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); };
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length !== prevMsgCount.current || loading) {
      prevMsgCount.current = messages.length;
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setStreamingMsgId(null);
    setIntentState('idle');
  }, [setIntentState]);

  const handleContinue = useCallback(async (msgId: string) => {
    if (!activeSessionId || loading) return;
    const msgs = getActiveSession()?.messages ?? [];
    const msgIndex = msgs.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    const lastContent = msgs[msgIndex]?.content || '';
    if (!lastContent) return;

    const asstId = genId();
    addMessage(activeSessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);
    setLoading(true);
    setIntentState('thinking');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const history = msgs.slice(0, msgIndex + 1)
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      let accumulated = '';
      setIntentState('responding');
      await GiaBrain.generate({
        prompt: 'Continue from where you left off. Do not repeat what was already said. Just continue naturally.',
        history: [...history, { role: 'assistant', content: lastContent }],
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          updateMessage(activeSessionId!, asstId, accumulated);
        },
      });
      if (!ctrl.signal.aborted) {
        updateMessage(activeSessionId!, asstId, accumulated);
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Continue failed.';
        updateMessage(activeSessionId!, asstId, msg);
      }
    } finally {
      setLoading(false);
      setStreamingMsgId(null);
      setIntentState('idle');
    }
  }, [activeSessionId, loading, getActiveSession, addMessage, updateMessage, setIntentState]);

  const handleDeleteWithUndo = useCallback((msgId: string) => {
    if (!activeSessionId) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    const msgs = getActiveSession()?.messages ?? [];
    const backup = [...msgs];
    useGiaStore.setState({
      sessions: useGiaStore.getState().sessions.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: s.messages.filter(m => m.id !== msgId), updatedAt: Date.now() }
          : s
      ),
    });
    setUndoMsg({ id: msgId, sessionId: activeSessionId, backup });
    undoTimeoutRef.current = setTimeout(() => {
      setUndoMsg(null);
    }, 5000);
  }, [activeSessionId, getActiveSession]);

  const handleUndoDelete = useCallback(() => {
    if (!undoMsg || !undoTimeoutRef.current) return;
    clearTimeout(undoTimeoutRef.current);
    useGiaStore.setState({
      sessions: useGiaStore.getState().sessions.map(s =>
        s.id === undoMsg.sessionId
          ? { ...s, messages: undoMsg.backup, updatedAt: Date.now() }
          : s
      ),
    });
    setUndoMsg(null);
    addNotification('Message restored');
  }, [undoMsg, addNotification]);

  const handleSend = useCallback(async () => {
    let text = input.trim();
    if (text.length > 8000) {
      const fileName = `long-input-${Date.now()}.txt`;
      setAttachments(prev => [...prev, { name: fileName, type: 'text/plain', content: text }]);
      text = 'I have attached a long text file for you to analyze.';
    }

    if ((!text && attachments.length === 0) || loading) return;

    let sessionId = activeSessionId;
    if (!sessionId) sessionId = createSession();

    const fileNames = attachments.map(a => a.name).join(', ');
    const userContent = text || (fileNames ? `[Files: ${fileNames}]` : '');

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    addMessage(sessionId, userMsg);
    const sentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setLoading(true);
    setIntentState('thinking');

    if (messages.length === 0 && text) {
      updateSessionTitle(sessionId, text.slice(0, 45) + (text.length > 45 ? '…' : ''));
    }

    let prompt = text;
    if (sentAttachments.length > 0) {
      const fileContext = sentAttachments
        .filter(a => !a.type.startsWith('image/'))
        .map(a => `\n[BEGIN FILE: ${a.name}]\n${a.content.slice(0, 20000)}\n[END FILE]`)
        .join('\n\n');
      const imgContext = sentAttachments
        .filter(a => a.type.startsWith('image/'))
        .map(a => `[Image: ${a.name}]`)
        .join('\n');
      prompt = `${fileContext}\n\n${imgContext}\n\nUSER: ${text}`;
    }

    const asstId = genId();
    addMessage(sessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const history = messages
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role, content: m.content }));

      const brainImages = sentAttachments
        .filter(a => a.type.startsWith('image/'))
        .map(a => ({ name: a.name, type: a.type, data: a.preview || '' }));

      let accumulated = '';
      setIntentState('responding');

      const handsOffPrefix = handsOff ? `[Hands-off mode active — you can control GIA's features with these commands embedded in your response (they'll be hidden from the user):
- [GIA:switch:module] — switch to chat/exam/analyst/writer/planner/settings
- [GIA:search:on/off] — toggle web search
- [GIA:think:on/off] — toggle extended thinking
- [GIA:notify:message] — show a notification
Use them naturally when the user's request calls for it. For example: "Let me analyze that [GIA:switch:analyst]" or "I'll search the web [GIA:search:on]"]\n\n` : '';

      const res = await GiaBrain.generate({
        prompt: handsOffPrefix + prompt, history,
        images: brainImages,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        temperature: extThinking ? undefined : 0.7,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          updateMessage(sessionId!, asstId, accumulated);
        },
      });

      if (!ctrl.signal.aborted) {
        const finalText = res.text || accumulated;
        const cleanText = parseCommands(finalText, sessionId);
        if (cleanText !== finalText) {
          updateMessage(sessionId!, asstId, cleanText);
        } else {
          updateMessage(sessionId!, asstId, finalText);
        }
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        updateMessage(sessionId!, asstId, msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.id === asstId ? { ...m, error: true } : m) }
              : s
          ),
        });
      }
    } finally {
      setLoading(false);
      setStreamingMsgId(null);
      setIntentState('idle');
    }
  }, [input, attachments, loading, activeSessionId, messages, webSearch, extThinking, createSession, addMessage, updateMessage, updateSessionTitle, setIntentState, handsOff]);

  const parseCommands = useCallback((text: string, sessionId: string) => {
    if (!handsOff) return text;
    const commandRegex = /\[GIA:(\w+)(?::([^\]]+))?\]/g;
    let match;
    let clean = text;
    while ((match = commandRegex.exec(text)) !== null) {
      const [full, action, param] = match;
      clean = clean.replace(full, '');
      switch (action) {
        case 'switch':
          if (['chat', 'exam', 'analyst', 'writer', 'planner', 'settings'].includes(param)) {
            setModule(param as any);
            addNotification(`Switched to ${param}`);
          }
          break;
        case 'search':
          if (param === 'on') setWebSearch(true);
          if (param === 'off') setWebSearch(false);
          break;
        case 'think':
          if (param === 'on') setExtThinking(true);
          if (param === 'off') setExtThinking(false);
          break;
        case 'notify':
          addNotification(param || 'GIA says hi');
          break;
      }
    }
    return clean.replace(/\s{2,}/g, ' ').trim();
  }, [handsOff, setModule, addNotification, setWebSearch, setExtThinking]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, isImage = false) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newAtts: Attachment[] = [];
    for (const file of files) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        if (isImage || file.type.startsWith('image/')) {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type, content: '', preview: reader.result as string }); resolve(); };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          reader.onload = async () => {
            try {
              const text = await PDFService.extractTextFromBase64(reader.result as string);
              newAtts.push({ name: file.name, type: file.type, content: text });
            } catch (err) {
              newAtts.push({ name: file.name, type: file.type, content: 'Failed to extract PDF text.' });
            }
            resolve();
          };
          reader.readAsDataURL(file);
        } else {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type, content: reader.result as string }); resolve(); };
          reader.readAsText(file);
        }
      });
    }
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportChat = () => {
    if (!activeSession) return;
    const text = activeSession.messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${activeSession.title}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (showHistory) {
    return (
      <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
        <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
          <button onClick={() => setShowHistory(false)} className="text-sm flex items-center gap-1" style={{ color: 'var(--gia-muted)' }}>
            ← Back
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Chats</span>
          <button onClick={() => { createSession(); setShowHistory(false); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#a855f7' }}>
            <Plus size={15} className="text-white" />
          </button>
        </div>
        <div className="px-4 pt-3 shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
            <input
              className="gia-input"
              style={{ paddingLeft: '30px', fontSize: '12px' }}
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search chats..."
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sessions.filter(s => s.title.toLowerCase().includes(historySearch.toLowerCase())).map((sess) => (
            <div key={sess.id} className="gia-card p-3 flex items-center gap-3 cursor-pointer transition-all tap-feedback" style={sess.id === activeSessionId ? { borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' } : {}} onClick={() => { setActiveSession(sess.id); setShowHistory(false); }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--gia-text)' }}>{sess.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{sess.messages.length} msgs · {new Date(sess.updatedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(sess.id); }} className="p-1.5 rounded-lg transition-colors text-zinc-600 hover:text-rose-400">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {sessions.filter(s => s.title.toLowerCase().includes(historySearch.toLowerCase())).length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--gia-muted-2)' }}>No chats found</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gia-bg)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg transition-colors tap-feedback" style={{ color: 'var(--gia-muted)' }}>
            <History size={15} />
          </button>
          <span className="text-xs font-medium truncate max-w-[130px]" style={{ color: 'var(--gia-muted)' }}>{activeSession?.title ?? 'New Chat'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="gia-pill" style={{
            background: providerConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: providerConnected ? '#34d399' : '#f87171',
            border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: providerConnected ? '#34d399' : '#f87171' }} />
            {providerLabel}
          </div>
          <button onClick={exportChat} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Download size={13} /></button>
          <button onClick={() => activeSessionId && clearSession(activeSessionId)} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Trash2 size={13} /></button>
          <button onClick={createSession} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Plus size={13} /></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-16 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1))', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Bot size={26} style={{ color: '#a855f7' }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--gia-text)' }}>{userProfile.name ? `Hey ${userProfile.name} ✦` : 'Hey, I\'m GIA'}</p>
              <p className="text-xs mt-1 max-w-[240px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{providerConnected ? 'Your personal AI workspace. Ask anything, attach files, or pick a quick start below.' : 'Connect a provider in Settings → Engine Room to get started.'}</p>
            </div>
            {providerConnected && (
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-1">
                {QUICK_STARTS.map((qs) => (
                  <button key={qs.label} onClick={() => setInput(qs.prompt)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-zinc-900/50 border border-zinc-800 hover:border-violet-500/30">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${qs.color}20` }}><qs.icon size={14} style={{ color: qs.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{qs.label}</p>
                      <p className="text-[10px] truncate text-zinc-500">{qs.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-2.5 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5" style={{ background: msg.role === 'user' ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : msg.error ? 'rgba(239,68,68,0.15)' : 'var(--gia-surface-2)', border: msg.role === 'assistant' ? '1px solid var(--gia-border)' : 'none' }}>
              {msg.role === 'user' ? <User size={13} className="text-white" /> : msg.error ? <AlertCircle size={13} style={{ color: '#f87171' }} /> : msg.thinking ? <div className="flex gap-0.5">{[0,1,2].map(d => <div key={d} className="thinking-dot" style={{ animationDelay: `${d * 0.16}s` }} />)}</div> : <Bot size={13} style={{ color: 'var(--gia-muted)' }} />}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {msg.attachments?.some(a => a.preview) && (
                <div className={`flex flex-wrap gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.attachments.filter(a => a.preview).map((a, ai) => (
                    <img key={ai} src={a.preview} alt={a.name} className="w-24 h-24 rounded-xl object-cover" style={{ border: '1px solid var(--gia-border)' }} />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mb-0.5 ml-1">
                <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: msg.role === 'user' ? '#a855f7' : 'var(--gia-muted-2)' }}>
                  {msg.role === 'user' ? 'You' : 'GIA'}
                </span>
                <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>
                  {formatTimeAgo(msg.timestamp)}
                </span>
              </div>
              <MessageContextMenu
                messageId={msg.id}
                content={msg.content}
                isUser={msg.role === 'user'}
                canFork={messages.length > 0}
                onCopy={copyMessage}
                onDelete={handleDeleteWithUndo}
                onContinue={handleContinue}
                onFork={(id) => {
                  const msgIndex = messages.findIndex(m => m.id === id);
                  if (activeSessionId && msgIndex >= 0) forkSession(activeSessionId, msgIndex);
                }}
                onRetry={async (id) => {
                  const msgIndex = messages.findIndex(m => m.id === id);
                  if (msgIndex <= 0 || !activeSessionId) return;
                  const msgs = getActiveSession()?.messages ?? [];
                  const originalPrompt = msgs[msgIndex - 1]?.content || '';
                  if (!originalPrompt) return;

                  const newAsstId = genId();
                  addMessage(activeSessionId, { id: newAsstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true });
                  setStreamingMsgId(newAsstId);
                  setLoading(true);
                  setIntentState('thinking');

                  try {
                    const history = msgs.slice(0, msgIndex - 1)
                      .filter(m => !m.thinking && m.content)
                      .map(m => ({ role: m.role, content: m.content }));
                    let accumulated = '';
                    setIntentState('responding');
                    await GiaBrain.generate({
                      prompt: originalPrompt,
                      history,
                      useWebSearch: webSearch,
                      useExtendedThinking: extThinking,
                      onStream: (chunk) => {
                        accumulated += chunk;
                        updateMessage(activeSessionId!, newAsstId, accumulated);
                      },
                    });
                    if (!abortRef.current?.signal.aborted) {
                      updateMessage(activeSessionId!, newAsstId, accumulated);
                    }
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Retry failed.';
                    updateMessage(activeSessionId!, newAsstId, msg);
                  } finally {
                    setLoading(false);
                    setStreamingMsgId(null);
                    setIntentState('idle');
                  }
                }}
              >
                <div className={`inline-block max-w-full px-4 py-3 ${msg.role === 'user' ? 'msg-user text-sm' : msg.error ? 'msg-error w-full' : 'msg-assistant w-full'}`}>
                  {msg.thinking ? <div className="flex gap-1.5 py-0.5">{[0,1,2].map(d => <div key={d} className="thinking-dot" style={{ animationDelay: `${d * 0.16}s` }} />)}</div> : msg.role === 'assistant' && !msg.error ? <MarkdownRenderer content={msg.content} /> : <p className="text-sm leading-relaxed">{msg.content}</p>}
                  {msg.attachments?.filter(a => !a.preview).map(att => (
                    <div key={att.name} className="mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}><Paperclip size={10} /> {att.name}</div>
                  ))}
                  {msg.error && (
                    <button onClick={() => {
                      const msgIndex = messages.findIndex(m => m.id === msg.id);
                      const userMsgIndex = msgIndex > 0 ? msgIndex - 1 : -1;
                      const userMsg = userMsgIndex >= 0 ? messages[userMsgIndex] : null;
                      if (userMsg && userMsg.role === 'user' && activeSessionId) {
                        setInput(userMsg.content);
                        addNotification('Error message selected — edit and resend');
                      }
                    }}
                      className="mt-2 text-[10px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <RotateCcw size={10} /> Retry
                    </button>
                  )}
                </div>
              </MessageContextMenu>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute right-4 bottom-32 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 bg-zinc-800 border border-zinc-700">
            <ChevronDown size={14} className="text-zinc-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Undo toast */}
      <AnimatePresence>
        {undoMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-4 right-4 bottom-28 z-20"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
              style={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
              <Trash2 size={13} style={{ color: '#f87171' }} />
              <span className="text-xs flex-1" style={{ color: 'var(--gia-text)' }}>Message deleted</span>
              <button onClick={handleUndoDelete}
                className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                <Undo2 size={11} /> Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <div className="px-4 pb-5 pt-1 shrink-0">
        <input ref={fileRef} type="file" className="hidden" multiple onChange={e => handleFile(e)} accept=".txt,.md,.pdf,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml" />
        <input ref={imgRef} type="file" className="hidden" multiple accept="image/*" onChange={e => handleFile(e, true)} />

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] bg-zinc-800 border border-zinc-700/50">
                {att.preview ? (
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                    <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Paperclip size={10} className="text-zinc-400 shrink-0" />
                )}
                <span className="text-zinc-300 truncate max-w-[100px]">{att.name}</span>
                <button onClick={() => removeAttachment(idx)} className="text-zinc-600 hover:text-rose-400 ml-0.5">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {[
            { label: 'File', icon: Paperclip, onClick: () => fileRef.current?.click(), active: false },
            { label: 'Image', icon: ImageIcon, onClick: () => imgRef.current?.click(), active: false },
            { label: 'Search', icon: Globe, onClick: () => setWebSearch(w => !w), active: webSearch, activeColor: '#3b82f6' },
            { label: 'Think', icon: Brain, onClick: () => setExtThinking(t => !t), active: extThinking, activeColor: '#f59e0b' },
            { label: 'Hands-off', icon: Zap, onClick: () => setHandsOff(h => !h), active: handsOff, activeColor: '#a855f7' },
            { label: 'Listen', icon: Headphones, onClick: () => { setVoiceEnabled(v => !v); if (!voiceEnabled) voiceControl.startListening(); else voiceControl.stopListening(); }, active: voiceEnabled, activeColor: '#ec4899' },
          ].map((tool) => (
            <button key={tool.label} onClick={tool.onClick} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback" style={{ background: tool.active ? `${tool.activeColor}20` : 'var(--gia-surface)', border: `1px solid ${tool.active ? `${tool.activeColor}40` : 'var(--gia-border)'}`, color: tool.active ? tool.activeColor : 'var(--gia-muted)', fontWeight: 500 }}>
              {(tool.active && tool.label === 'Listen' && voiceControl.isHearing) ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#ec4899' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#ec4899' }} />
                </span>
              ) : <tool.icon size={11} />}
              {tool.active && tool.label === 'Listen' && voiceControl.isHearing ? 'Hearing' : tool.label}
            </button>
          ))}
        </div>
        <AmbientInput value={input} onChange={setInput} onSubmit={handleSend} onStop={loading ? handleStop : undefined} isLoading={loading} placeholder={webSearch ? 'Ask anything — I\'ll search the web…' : handsOff ? 'GIA has control — ask and it acts…' : 'Message GIA…'} />
      </div>
    </div>
  );
};

export default React.memo(ChatModule);
