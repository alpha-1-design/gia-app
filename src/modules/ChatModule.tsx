import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, AlertCircle, Plus, History, Trash2, GitFork,
  Paperclip, X, Download, Globe, Copy, Check, Image as ImageIcon,
  Brain, Link, ChevronDown, Sparkles, GraduationCap, Code2,
  BookOpen, Zap, Square,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GiaBrain from '../services/GiaBrain';
import { useGiaStore, Message } from '../store/useGiaStore';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import AmbientInput from '../components/AmbientInput';
import PDFService from '../services/PDFService';

const genId = () => Math.random().toString(36).slice(2, 10);

type Attachment = { name: string; type: string; content: string; preview?: string };

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
  const [showHistory, setShowHistory] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    sessions, activeSessionId, createSession, setActiveSession,
    addMessage, updateMessage, updateSessionTitle, deleteSession,
    forkSession, clearSession, setModule, getActiveSession, userProfile,
    setIntentState,
  } = useGiaStore();

  const { providers, activeProvider } = useProviderStore();
  const providerLabel = PROVIDER_DEFAULTS[activeProvider]?.label ?? activeProvider;
  const providerConnected = providers[activeProvider]?.enabled ?? false;
  const activeModel = providers[activeProvider]?.model ?? '';
  const canExtendThink = activeProvider === 'anthropic' && activeModel.includes('claude-3-7');

  const activeSession = getActiveSession();
  const messages = activeSession?.messages ?? [];

  useEffect(() => { if (!activeSessionId) createSession(); }, []);

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

      const res = await GiaBrain.generate({
        prompt, history,
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
        updateMessage(sessionId!, asstId, res.text || accumulated);
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        updateMessage(sessionId!, asstId, msg);
      }
    } finally {
      setLoading(false);
      setStreamingMsgId(null);
      setIntentState('idle');
    }
  }, [input, attachments, loading, activeSessionId, messages, webSearch, extThinking, createSession, addMessage, updateMessage, updateSessionTitle, setIntentState]);

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
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sessions.map((sess) => (
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
              <div className={`inline-block max-w-full px-4 py-3 ${msg.role === 'user' ? 'msg-user text-sm' : msg.error ? 'msg-error w-full' : 'msg-assistant w-full'}`}>
                {msg.thinking ? <div className="flex gap-1.5 py-0.5">{[0,1,2].map(d => <div key={d} className="thinking-dot" style={{ animationDelay: `${d * 0.16}s` }} />)}</div> : msg.role === 'assistant' && !msg.error ? <MarkdownRenderer content={msg.content} /> : <p className="text-sm leading-relaxed">{msg.content}</p>}
                {msg.attachments?.filter(a => !a.preview).map(att => (
                  <div key={att.name} className="mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}><Paperclip size={10} /> {att.name}</div>
                ))}
              </div>
              {msg.role === 'assistant' && !msg.thinking && msg.content && (
                <div className="flex gap-2 ml-1 mt-1.5 transition-all">
                  <button onClick={() => copyMessage(msg.id, msg.content)} className="text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 transition-colors" style={{ color: copiedId === msg.id ? '#34d399' : 'var(--gia-muted)' }}>{copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />} {copiedId === msg.id ? 'Copied' : 'Copy'}</button>
                  {messages.length > 4 && (
                    <button onClick={() => { if (activeSessionId) forkSession(activeSessionId, i); }} className="text-[10px] flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 transition-colors" style={{ color: 'var(--gia-muted)' }}><GitFork size={11} /> Fork</button>
                  )}
                </div>
              )}
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

      <div className="px-4 pb-5 pt-1 shrink-0">
        <input ref={fileRef} type="file" className="hidden" multiple onChange={e => handleFile(e)} accept=".txt,.md,.pdf,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml" />
        <input ref={imgRef} type="file" className="hidden" multiple accept="image/*" onChange={e => handleFile(e, true)} />
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {[
            { label: 'File', icon: Paperclip, onClick: () => fileRef.current?.click(), active: false },
            { label: 'Image', icon: ImageIcon, onClick: () => imgRef.current?.click(), active: false },
            { label: 'Search', icon: Globe, onClick: () => setWebSearch(w => !w), active: webSearch, activeColor: '#3b82f6' },
            ...(canExtendThink ? [{ label: 'Think', icon: Brain, onClick: () => setExtThinking(t => !t), active: extThinking, activeColor: '#f59e0b' }] : []),
          ].map((tool) => (
            <button key={tool.label} onClick={tool.onClick} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback" style={{ background: tool.active ? `${tool.activeColor}20` : 'var(--gia-surface)', border: `1px solid ${tool.active ? `${tool.activeColor}40` : 'var(--gia-border)'}`, color: tool.active ? tool.activeColor : 'var(--gia-muted)', fontWeight: 500 }}>
              <tool.icon size={11} /> {tool.label}
            </button>
          ))}
        </div>
        <AmbientInput value={input} onChange={setInput} onSubmit={handleSend} onStop={loading ? handleStop : undefined} isLoading={loading} placeholder={webSearch ? 'Ask anything — I\'ll search the web…' : 'Message GIA…'} />
      </div>
    </div>
  );
};

export default ChatModule;
