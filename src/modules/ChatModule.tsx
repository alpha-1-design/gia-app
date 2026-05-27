import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, User, AlertCircle, Plus, History, Trash2,
  Paperclip, X, Download, Globe, Image as ImageIcon,
  Brain, ChevronDown, ChevronRight, Sparkles, GraduationCap, Code2,
  BookOpen, Zap, Undo2, Search, RotateCcw, Headphones, FileCode,
  Terminal, Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { ThinkingPanel } from '../components/ThinkingPanel';
import GiaBrain from '../services/GiaBrain';
import TTSService from '../services/TTSService';
import { useGiaStore, Message, Skill } from '../store/useGiaStore';
import { useProviderStore, PROVIDER_DEFAULTS } from '../store/useProviderStore';
import MarkdownRenderer from '../components/MarkdownRenderer';
import MessageContextMenu from '../components/MessageContextMenu';
import AmbientInput from '../components/AmbientInput';
import PDFService from '../services/PDFService';
import { useVoiceControl } from '../hooks/useVoiceControl';
import SkillPicker from '../components/SkillPicker';
import GiaConsole from '../components/GiaConsole';
import { KnowledgePanel } from '../components/KnowledgePanel';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '../store/useProtocolStore';
import { ProtocolProposal, PROTOCOL_META } from '../types/protocol';

const genId = () => {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => '0123456789abcdefghijklmnopqrstuvwxyz'[b % 36]).join('');
};

const stripToolBlocks = (text: string): string => {
  let result = text.replace(/```tool[\s\S]*?```/g, '');
  result = result.replace(/```tool[\s\S]*$/gm, '');
  result = result.replace(/```[\s\S]*?"(?:tool|function|name)"[\s\S]*?```/g, '');
  result = result.replace(/^\s*\{(?:[^{}]|"(?:[^"\\]|\\.)*")*"(?:tool|function|name)"\s*:[\s\S]*?\}\s*$/gm, '');
  result = result.replace(/(?:^|\n)\s*```[\s\S]*?(?:$|\n```)/g, '');
  return result.trim();
};

const processStreamForDisplay = (accumulated: string): string => {
  return stripToolBlocks(accumulated) || '…';
};

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

const LONG_MSG_CHARS = 3000;

const ProtocolBanner: React.FC<{ protocol: ProtocolProposal }> = ({ protocol }) => {
  const { confirm, reject } = useProtocolStore();
  const meta = PROTOCOL_META[protocol.type] || PROTOCOL_META.custom;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl border mx-1"
      style={{ borderColor: `${meta.color}33`, background: `${meta.color}08` }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{meta.label}</p>
        <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted)' }}>{protocol.summary}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => confirm(protocol.id)} className="text-[9px] font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105" style={{ background: '#22c55e', color: 'white' }}>
          Execute
        </button>
        <button onClick={() => reject(protocol.id)} className="text-[9px] font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          Reject
        </button>
      </div>
    </motion.div>
  );
};

const ChatModule: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [undoMsg, setUndoMsg] = useState<{ id: string; sessionId: string; backup: any[] } | null>(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [showThoughts, setShowThoughts] = useState<Set<string>>(new Set());
  const [liveThoughts, setLiveThoughts] = useState<Record<string, string>>({});
  const [showKnowledge, setShowKnowledge] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight requests on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [inputContainerHeight, setInputContainerHeight] = useState(140);

  const {
    sessions, activeSessionId, createSession, setActiveSession,
    addMessage, updateMessage, updateSessionTitle, deleteSession,
    forkSession, clearSession, setModule, getActiveSession, userProfile,
    setIntentState, addNotification,
    setShowConsole, showConsole, consoleLogs,
    webSearch, setWebSearch,
    extThinking, setExtThinking,
    handsOff, setHandsOff,
    skills, activeSkillId, setSkill,
    wakeWord
  } = useGiaStore();

  const { providers, activeProvider } = useProviderStore();
  const pendingProtocols = useProtocolStore(useShallow(s => s.protocols.filter(p => p.state === 'proposed')));
  const providerLabel = PROVIDER_DEFAULTS[activeProvider]?.label ?? activeProvider;
  const providerConnected = providers[activeProvider]?.enabled ?? false;
  const activeModel = providers[activeProvider]?.model ?? '';

  const keepListening = useGiaStore(s => s.keepListening);
  const keepListeningRef = useRef(keepListening);
  keepListeningRef.current = keepListening;

  const handleWakeWord = useCallback((transcript: string) => {
    const ww = useGiaStore.getState().wakeWord;
    if (!ww) return;
    const query = transcript.replace(new RegExp(ww.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
    if (query) {
      setInput(query);
      addNotification('Wake word detected');
    }
  }, [addNotification]);

  const handleVoiceTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    // Short phrases: no polishing needed
    if (transcript.split(' ').length < 8) {
      setInput(transcript);
      return;
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);

    addNotification('Polishing transcript...');
    try {
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: `The following is a raw voice-to-text transcript. Please polish it for clarity, grammar, and punctuation while maintaining the original intent and tone. Return ONLY the polished text.\n\nRaw Transcript: "${transcript}"`,
        temperature: 0.3,
        maxTokens: 1000,
      });
      clearTimeout(timeout);
      if (res.text && !ctrl.signal.aborted) {
        setInput(res.text.trim());
      }
    } catch (e) {
      clearTimeout(timeout);
      setInput(transcript);
    }
  }, [addNotification, setInput]);

  const voiceControl = useVoiceControl({
    wakeWord,
    onWakeWord: handleWakeWord,
    onTranscript: handleVoiceTranscript,
    keepListening,
    autoStopAfter: 120000,
  });
  const voiceRef = useRef(voiceControl);
  voiceRef.current = voiceControl;

  const [showTools, setShowTools] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeSession = getActiveSession();
  const messages: Message[] = activeSession?.messages ?? [];

  useEffect(() => {
    if (voiceEnabled) {
      voiceRef.current.startListening();
    }
    return () => {
      voiceRef.current.stopListening();
    };
  }, [voiceEnabled]);

  const toggleFeature = useCallback((feature: 'webSearch' | 'extThinking' | 'handsOff' | 'listen') => {
    setIsSyncing(true);
    if (feature === 'webSearch') setWebSearch(!webSearch);
    if (feature === 'extThinking') setExtThinking(!extThinking);
    if (feature === 'handsOff') setHandsOff(!handsOff);
    if (feature === 'listen') {
      const newState = !voiceEnabled;
      setVoiceEnabled(newState);
      if (newState) voiceRef.current.startListening();
      else voiceRef.current.stopListening();
    }
    
    // Simulate tiny delay to show sync indicator then clear it
    setTimeout(() => setIsSyncing(false), 300);
  }, [setWebSearch, setExtThinking, setHandsOff, webSearch, extThinking, handsOff, voiceEnabled]);

  useEffect(() => { if (!activeSessionId) createSession(); }, []);

  useEffect(() => {
    return () => { if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const el = inputContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setInputContainerHeight(entry.contentRect.height + 28);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
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
    TTSService.stop();
    if (streamingMsgId && activeSessionId) {
      const session = useGiaStore.getState().sessions.find(s => s.id === activeSessionId);
      const ghost = session?.messages.find(m => m.id === streamingMsgId);
      if (ghost) {
        if (!ghost.content && ghost.thinking) {
          useGiaStore.setState({
            sessions: useGiaStore.getState().sessions.map(s =>
              s.id === activeSessionId
                ? { ...s, messages: s.messages.filter(m => m.id !== streamingMsgId), updatedAt: Date.now() }
                : s
            ),
          });
        } else {
          const finalContent = (ghost.content || '') + '\n\n*— Response stopped —*';
          updateMessage(activeSessionId, streamingMsgId, finalContent, ghost.thoughts);
        }
      }
    }
    setLoading(false);
    setStreamingMsgId(null);
    setIntentState('idle');
  }, [setIntentState, streamingMsgId, activeSessionId, updateMessage]);

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
      let thoughtsAccumulated = '';
      let inThinkBlock = false;
      let inToolBlock = false;
      setIntentState('responding');
      const contRes = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: 'Continue from where you left off. Do not repeat what was already said. Just continue naturally.',
        history: [...history, { role: 'assistant', content: lastContent }],
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          let remaining = chunk;
          let displayChunk = '';
          while (remaining.length > 0) {
            if (inThinkBlock) {
              const endIdx = remaining.indexOf('</think>');
              if (endIdx >= 0) {
                thoughtsAccumulated += remaining.slice(0, endIdx);
                remaining = remaining.slice(endIdx + 8);
                inThinkBlock = false;
              } else {
                thoughtsAccumulated += remaining;
                remaining = '';
              }
            } else if (inToolBlock) {
              const endIdx = remaining.indexOf('\n```');
              if (endIdx >= 0) {
                remaining = remaining.slice(endIdx + 4);
                inToolBlock = false;
              } else if (remaining.startsWith('```')) {
                remaining = remaining.slice(3);
                inToolBlock = false;
              } else {
                remaining = '';
              }
            } else {
              const thinkStart = remaining.indexOf('<think>');
              let toolStart = remaining.indexOf('```tool');
              if (toolStart > 0 && remaining[toolStart - 1] !== '\n') toolStart = -1;
              if (toolStart >= 0 && (thinkStart === -1 || toolStart < thinkStart)) {
                const before = remaining.slice(0, toolStart);
                displayChunk += before;
                const afterFence = remaining.slice(toolStart + 7);
                const closeIdx = afterFence.indexOf('\n```');
                if (closeIdx >= 0) {
                  remaining = afterFence.slice(closeIdx + 4);
                } else if (afterFence.startsWith('```')) {
                  remaining = afterFence.slice(3);
                } else {
                  inToolBlock = true;
                  remaining = '';
                }
              } else if (thinkStart >= 0) {
                const before = remaining.slice(0, thinkStart);
                displayChunk += before;
                remaining = remaining.slice(thinkStart + 7);
                inThinkBlock = true;
              } else {
                displayChunk += remaining;
                remaining = '';
              }
            }
          }
          accumulated += displayChunk;
          const displayText = processStreamForDisplay(accumulated);
          updateMessage(activeSessionId!, asstId, displayText, thoughtsAccumulated || undefined);
          if (displayChunk.trim().length > 1) {
            TTSService.speak(displayChunk, true);
          }
        },
        onThought: (thought) => {
          thoughtsAccumulated += (thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: thoughtsAccumulated }));
          updateMessage(activeSessionId!, asstId, processStreamForDisplay(accumulated), thoughtsAccumulated);
        },
      });
      if (!ctrl.signal.aborted) {
        if (inThinkBlock && thoughtsAccumulated) {
          accumulated += '<think>' + thoughtsAccumulated;
          thoughtsAccumulated = '';
          inThinkBlock = false;
        }
        updateMessage(activeSessionId!, asstId, processStreamForDisplay(accumulated) || accumulated, thoughtsAccumulated || undefined);
        if (contRes.model) {
          useGiaStore.setState({
            sessions: useGiaStore.getState().sessions.map(s =>
              s.id === activeSessionId
                ? { ...s, messages: s.messages.map(m => m.id === asstId ? { ...m, model: contRes.model } : m) }
                : s
            ),
          });
        }
        TTSService.speak(accumulated);
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Continue failed.';
        updateMessage(activeSessionId!, asstId, '⚠️ ' + msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === activeSessionId
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

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (value === '/') {
      setShowSkillPicker(true);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (input.trim() === '/') {
      setShowSkillPicker(true);
      setInput('');
      return;
    }
    if (input.trim().startsWith('/')) {
      setShowSkillPicker(true);
      return;
    }

    let text = input.trim();
    if (text.length > 12000) { // Increased limit
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
    TTSService.stop();
    const sentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setLoading(true);
    setIntentState('thinking');

    if (messages.length === 0) {
      const titleText = text || fileNames || 'Attached files';
      updateSessionTitle(sessionId, titleText.slice(0, 45) + (titleText.length > 45 ? '…' : ''));
    }

    let prompt = text;
    if (sentAttachments.length > 0) {
      const fileContext = sentAttachments
        .filter(a => !a.type.startsWith('image/'))
        .map(a => `\n[BEGIN FILE: ${a.name}]\n${a.content.slice(0, 30000)}\n[END FILE]`)
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
        .filter(a => a.type.startsWith('image/') && a.preview)
        .map(a => ({ name: a.name, type: a.type, data: a.preview! }));

      let accumulated = '';
      let thoughtsAccumulated = '';
      let inThinkBlock = false;
      let inToolBlock = false;
      setIntentState('responding');

      const handsOffPrefix = handsOff ? `[HANDS-OFF MODE: You have full control. Use built-in tools (web_search, filesystem_read, filesystem_write, terminal_run) freely.
To bundle files, respond with \`[GIA:zip:filename.zip]\` after outputting the file contents in \`[FILE:path] content [FILE]\` format.]\n\n` : '';

      const stateContext = `[SYSTEM: Current Feature State:
- Web Search: ${webSearch ? 'ON' : 'OFF'}
- Extended Thinking: ${extThinking ? 'ON' : 'OFF'}
- Hands-off Mode: ${handsOff ? 'ON' : 'OFF'}]\n\n`;

      const processStreamChunk = (chunk: string) => {
        if (ctrl.signal.aborted) return;
        let remaining = chunk;
        let displayChunk = '';
        while (remaining.length > 0) {
          if (inThinkBlock) {
            const endIdx = remaining.indexOf('</think>');
            if (endIdx >= 0) {
              thoughtsAccumulated += remaining.slice(0, endIdx);
              remaining = remaining.slice(endIdx + 8);
              inThinkBlock = false;
            } else {
              thoughtsAccumulated += remaining;
              remaining = '';
            }
          } else if (inToolBlock) {
            const endIdx = remaining.indexOf('\n```');
            if (endIdx >= 0) {
              remaining = remaining.slice(endIdx + 4);
              inToolBlock = false;
            } else if (remaining.startsWith('```')) {
              remaining = remaining.slice(3);
              inToolBlock = false;
            } else {
              remaining = '';
            }
          } else {
            const thinkStart = remaining.indexOf('<think>');
            let toolStart = remaining.indexOf('```tool');
            if (toolStart > 0 && remaining[toolStart - 1] !== '\n') toolStart = -1;
            if (toolStart >= 0 && (thinkStart === -1 || toolStart < thinkStart)) {
              const before = remaining.slice(0, toolStart);
              displayChunk += before;
              const afterFence = remaining.slice(toolStart + 7);
              const closeIdx = afterFence.indexOf('\n```');
              if (closeIdx >= 0) {
                remaining = afterFence.slice(closeIdx + 4);
              } else if (afterFence.startsWith('```')) {
                remaining = afterFence.slice(3);
              } else {
                inToolBlock = true;
                remaining = '';
              }
            } else if (thinkStart >= 0) {
              const before = remaining.slice(0, thinkStart);
              displayChunk += before;
              remaining = remaining.slice(thinkStart + 7);
              inThinkBlock = true;
            } else {
              displayChunk += remaining;
              remaining = '';
            }
          }
        }
        accumulated += displayChunk;
        const displayText = processStreamForDisplay(accumulated);
        updateMessage(sessionId!, asstId, displayText, thoughtsAccumulated || undefined);

        if (displayChunk.trim().length > 1) {
          TTSService.speak(displayChunk, true);
        }
      };

      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: stateContext + handsOffPrefix + prompt, history,
        images: brainImages,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        temperature: extThinking ? undefined : 0.7,
        onStream: (chunk) => processStreamChunk(chunk),
        onThought: (thought) => {
          thoughtsAccumulated += (thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: thoughtsAccumulated }));
          updateMessage(sessionId!, asstId, processStreamForDisplay(accumulated), thoughtsAccumulated);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
        }
      });

      if (ctrl.signal.aborted) return;

      if (inThinkBlock && thoughtsAccumulated) {
        accumulated += '<think>' + thoughtsAccumulated;
        thoughtsAccumulated = '';
        inThinkBlock = false;
      }

      if (res.text === '__CLARIFICATION__') {
        const stored = useGiaStore.getState().clarification;
        if (stored) {
          useGiaStore.setState({
            clarification: { ...stored, sessionId: sessionId!, assistantMsgId: asstId },
          });
          updateMessage(sessionId!, asstId, processStreamForDisplay(accumulated), thoughtsAccumulated || undefined);
        }
        setIntentState('idle');
        return;
      }

      const rawContent = processStreamForDisplay(accumulated);
      const finalText = rawContent || (() => {
        const t = (res.text || '').replace(/```tool[\s\S]*?```/g, '').trim();
        const m = t.match(/<think>([\s\S]*?)<\/think>/);
        if (m) {
          thoughtsAccumulated = m[1].trim();
          return t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
        return t;
      })();
      updateMessage(sessionId!, asstId, finalText, thoughtsAccumulated || undefined);
      if (res.model) {
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.id === asstId ? { ...m, model: res.model } : m) }
              : s
          ),
        });
      }
      if (res.modelSwitched && res.switchReason) {
        addNotification(res.switchReason);
      }
      TTSService.speak(finalText);
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
      setLiveThoughts(prev => { const n = {...prev}; delete n[asstId]; return n; });
      setLoading(false);
      setStreamingMsgId(null);
      setIntentState('idle');
    }
  }, [input, attachments, loading, activeSessionId, messages, webSearch, extThinking, createSession, addMessage, updateMessage, updateSessionTitle, setIntentState, handsOff]);

  const handleClarificationAnswer = useCallback(async (answer: string) => {
    const clarification = useGiaStore.getState().clarification;
    if (!clarification) return;
    useGiaStore.getState().setClarification(null);

    const sessionId = clarification.sessionId || activeSessionId;
    if (!sessionId) return;

    addMessage(sessionId, {
      id: genId(), role: 'user', content: answer, timestamp: Date.now(),
    });

    const asstId = genId();
    addMessage(sessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setIntentState('responding');

    try {
      const allMsgs = messages
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      allMsgs.push({ role: 'user', content: answer });

      let accumulated = '';
      let thoughtsAccumulated = '';
      let inThinkBlock = false;
      let inToolBlock = false;
      await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: '', history: allMsgs,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        temperature: extThinking ? undefined : 0.7,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          let remaining = chunk;
          let displayChunk = '';
          while (remaining.length > 0) {
            if (inThinkBlock) {
              const endIdx = remaining.indexOf('</think>');
              if (endIdx >= 0) {
                thoughtsAccumulated += remaining.slice(0, endIdx);
                remaining = remaining.slice(endIdx + 8);
                inThinkBlock = false;
              } else {
                thoughtsAccumulated += remaining;
                remaining = '';
              }
            } else if (inToolBlock) {
              const endIdx = remaining.indexOf('\n```');
              if (endIdx >= 0) {
                remaining = remaining.slice(endIdx + 4);
                inToolBlock = false;
              } else if (remaining.startsWith('```')) {
                remaining = remaining.slice(3);
                inToolBlock = false;
              } else {
                remaining = '';
              }
            } else {
              const thinkStart = remaining.indexOf('<think>');
              let toolStart = remaining.indexOf('```tool');
              if (toolStart > 0 && remaining[toolStart - 1] !== '\n') toolStart = -1;
              if (toolStart >= 0 && (thinkStart === -1 || toolStart < thinkStart)) {
                const before = remaining.slice(0, toolStart);
                displayChunk += before;
                const afterFence = remaining.slice(toolStart + 7);
                const closeIdx = afterFence.indexOf('\n```');
                if (closeIdx >= 0) {
                  remaining = afterFence.slice(closeIdx + 4);
                } else if (afterFence.startsWith('```')) {
                  remaining = afterFence.slice(3);
                } else {
                  inToolBlock = true;
                  remaining = '';
                }
              } else if (thinkStart >= 0) {
                const before = remaining.slice(0, thinkStart);
                displayChunk += before;
                remaining = remaining.slice(thinkStart + 7);
                inThinkBlock = true;
              } else {
                displayChunk += remaining;
                remaining = '';
              }
            }
          }
          accumulated += displayChunk;
          const displayText = processStreamForDisplay(accumulated);
          updateMessage(sessionId, asstId, displayText, thoughtsAccumulated || undefined);
          if (displayChunk.trim().length > 1) {
            TTSService.speak(displayChunk, true);
          }
        },
        onThought: (thought) => {
          thoughtsAccumulated += (thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: thoughtsAccumulated }));
          updateMessage(sessionId, asstId, processStreamForDisplay(accumulated), thoughtsAccumulated);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
          setShowConsole(true);
        }
      });
      if (!ctrl.signal.aborted) {
        if (inThinkBlock && thoughtsAccumulated) {
          accumulated += '<think>' + thoughtsAccumulated;
          thoughtsAccumulated = '';
          inThinkBlock = false;
        }
        updateMessage(sessionId, asstId, processStreamForDisplay(accumulated) || accumulated, thoughtsAccumulated || undefined);
        TTSService.speak(accumulated);
      }
    } catch (err: unknown) {
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        updateMessage(sessionId, asstId, msg);
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
  }, [activeSessionId, messages, webSearch, extThinking, addMessage, updateMessage, setIntentState]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, isImage = false) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (isImage && !GiaBrain.isVisionCapable(activeModel, activeProvider)) {
      addNotification(`This provider (${providerLabel}) may not support image analysis.`);
    }
    const newAtts: Attachment[] = [];
    for (const file of files) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        const onError = () => { newAtts.push({ name: file.name, type: file.type || 'application/octet-stream', content: `Failed to read file: ${file.name}` }); resolve(); };
        if (isImage || file.type.startsWith('image/')) {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type, content: '', preview: reader.result as string }); resolve(); };
          reader.onerror = onError;
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
          reader.onerror = onError;
          reader.readAsDataURL(file);
        } else {
          reader.onload = () => { newAtts.push({ name: file.name, type: file.type || 'text/plain', content: reader.result as string }); resolve(); };
          reader.onerror = onError;
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  if (showHistory) {
    return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--gia-bg)' }}>
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
          {sessions.filter(s => {
            if (s.title.toLowerCase().includes(historySearch.toLowerCase())) return true;
            if (!historySearch) return false;
            return s.messages.some(m => m.content.toLowerCase().includes(historySearch.toLowerCase()));
          }).map((sess) => {
            const matchCount = historySearch ? sess.messages.filter(m => m.content.toLowerCase().includes(historySearch.toLowerCase())).length : 0;
            return (
              <div key={sess.id} className="gia-card p-3 flex items-center gap-3 cursor-pointer transition-all tap-feedback" style={sess.id === activeSessionId ? { borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' } : {}} onClick={() => { setActiveSession(sess.id); setShowHistory(false); }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--gia-text)' }}>{sess.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{sess.messages.length} msgs · {new Date(sess.updatedAt).toLocaleDateString()}{matchCount > 0 ? ` · ${matchCount} match${matchCount > 1 ? 'es' : ''}` : ''}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(sess.id); }} className="p-1.5 rounded-lg transition-colors text-zinc-600 hover:text-rose-400">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          {sessions.filter(s => {
            if (s.title.toLowerCase().includes(historySearch.toLowerCase())) return true;
            if (!historySearch) return false;
            return s.messages.some(m => m.content.toLowerCase().includes(historySearch.toLowerCase()));
          }).length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--gia-muted-2)' }}>No chats found{historySearch ? ` for "${historySearch}"` : ''}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--gia-bg)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg transition-colors tap-feedback" style={{ color: 'var(--gia-muted)' }}>
            <History size={15} />
          </button>
          <span className="text-xs font-medium truncate max-w-[130px]" style={{ color: 'var(--gia-muted)' }}>{activeSession?.title ?? 'New Chat'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="gia-pill flex items-center gap-1.5" style={{
            background: providerConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: providerConnected ? '#34d399' : '#f87171',
            border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: providerConnected ? '#34d399' : '#f87171' }} />
            <span className="truncate max-w-[60px]">{providerLabel}</span>
            {activeModel && providerConnected && (
              <span className="text-[7px] opacity-50 truncate max-w-[60px]">{activeModel.split('/').pop()}</span>
            )}
          </div>
          <button onClick={() => setShowKnowledge(true)} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Brain size={13} /></button>
          <button onClick={exportChat} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Download size={13} /></button>
          <button onClick={() => activeSessionId && clearSession(activeSessionId)} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Trash2 size={13} /></button>
          <button onClick={createSession} className="p-1.5 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}><Plus size={13} /></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pt-4 space-y-2 sm:space-y-3 relative z-0" style={{ paddingBottom: `${inputContainerHeight}px` }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pt-12 sm:pt-16 pb-24 sm:pb-40 animate-fade-in">
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

        {!providerConnected && !loading && (
          <div onClick={() => useGiaStore.getState().setModule('settings')} className="px-4 py-3 mx-4 rounded-2xl text-center cursor-pointer transition-opacity hover:opacity-80" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>⚡ No AI provider configured</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>Tap to go to Settings → Engine Room and type: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>connect</code></p>
          </div>
        )}

        {pendingProtocols.length > 0 && (
          <div className="space-y-2 px-1">
            <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gia-muted)' }}>Pending Action</p>
            {pendingProtocols.map(p => <ProtocolBanner key={p.id} protocol={p} />)}
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-2 sm:gap-3 md:gap-3.5 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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

                  const ctrl = new AbortController();
                  abortRef.current = ctrl;

                  updateMessage(activeSessionId, id, '');
                  useGiaStore.setState({
                    sessions: useGiaStore.getState().sessions.map(s =>
                      s.id === activeSessionId
                        ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, thinking: true, error: false } : m) }
                        : s
                    ),
                  });
                  setStreamingMsgId(id);
                  setLoading(true);
                  setIntentState('thinking');

                  try {
                    const history = msgs.slice(0, msgIndex - 1)
                      .filter(m => !m.thinking && m.content)
                      .map(m => ({ role: m.role, content: m.content }));

                    let accumulated = '';
                    setIntentState('responding');
                    const genRes = await GiaBrain.generate({
                      signal: ctrl.signal,
                      prompt: originalPrompt,
                      history,
                      useWebSearch: webSearch,
                      useExtendedThinking: extThinking,
                      onStream: (chunk) => {
                        if (ctrl.signal.aborted) return;
                        accumulated += chunk;
                        updateMessage(activeSessionId!, id, processStreamForDisplay(accumulated));
                      },
                    });
                    if (!ctrl.signal.aborted) {
                      updateMessage(activeSessionId!, id, stripToolBlocks(accumulated));
                      if (genRes.model) {
                        useGiaStore.setState({
                          sessions: useGiaStore.getState().sessions.map(s =>
                            s.id === activeSessionId
                              ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, model: genRes.model } : m) }
                              : s
                          ),
                        });
                      }
                      if (genRes.modelSwitched && genRes.switchReason) {
                        addNotification(`Model switched: ${genRes.switchReason}`);
                      }
                      TTSService.speak(accumulated);
                    }
                  } catch (e: any) {
                    if (!ctrl.signal.aborted) {
                      useGiaStore.setState({
                        sessions: useGiaStore.getState().sessions.map(s =>
                          s.id === activeSessionId
                            ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, content: e.message || 'Retry failed', error: true, thinking: false } : m) }
                            : s
                        ),
                      });
                    }
                  } finally {
                    setLoading(false);
                    setStreamingMsgId(null);
                    setIntentState('idle');
                  }
                }}
              >
                <div 
                  className={`p-3 sm:p-4 md:p-5 rounded-2xl relative select-none transition-shadow ${msg.role === 'user' ? 'bg-violet-600/10 border border-violet-500/20' : msg.error ? 'bg-rose-950/20 border border-rose-800/30' : 'bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700/60'}`}
                  style={{
                    borderTopRightRadius: msg.role === 'user' ? '4px' : '20px',
                    borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '20px',
                    boxShadow: msg.role === 'assistant' && !msg.error && !msg.thinking ? '0 1px 8px rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  {msg.thinking ? (
                    <div>
                      <div className="flex gap-1.5 items-center py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                      {liveThoughts[msg.id] || msg.thoughts ? (
                        <ThinkingPanel
                          thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                          isLive={!!liveThoughts[msg.id]}
                          isExpanded={showThoughts.has(msg.id) || !!liveThoughts[msg.id]}
                          onToggle={() => setShowThoughts(prev => {
                            const n = new Set(prev);
                            n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id);
                            return n;
                          })}
                        />
                      ) : null}
                    </div>
                  ) : msg.error ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm leading-relaxed" style={{ color: '#f87171' }}>{msg.content}</p>
                      <button onClick={() => {
                        const userMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                        if (userMsgIndex >= 0 && activeSessionId) {
                          setInput(messages[userMsgIndex].content);
                          addNotification('Edit and resend');
                        }
                      }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] w-fit" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <RotateCcw size={10} /> Edit & Resend
                      </button>
                    </div>
                    ) : (
                    <>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1.5 ml-0.5">
                          <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
                            {msg.model ? `via ${msg.model}` : 'GIA'}
                          </span>
                          {msg.thinking ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>
                              Thinking…
                            </span>
                          ) : streamingMsgId === msg.id ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                              Generating…
                            </span>
                          ) : (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                              Done
                            </span>
                          )}
                        </div>
                      )}
                      {msg.content.length > LONG_MSG_CHARS && !expandedMsgs.has(msg.id) ? (
                        <>
                          <MarkdownRenderer content={msg.content.slice(0, LONG_MSG_CHARS)} />
                          <button onClick={() => setExpandedMsgs(prev => new Set(prev).add(msg.id))} className="mt-2 text-[11px] font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                            Show more ({Math.ceil((msg.content.length - LONG_MSG_CHARS) / 1000)}k+ chars)
                          </button>
                        </>
                      ) : (
                        <div className="token-reveal">
                          <MarkdownRenderer content={msg.content} />
                          {streamingMsgId === msg.id && msg.content && (
                            <span className="stream-cursor ml-0.5">▋</span>
                          )}
                          {expandedMsgs.has(msg.id) && (
                            <button onClick={() => setExpandedMsgs(prev => { const n = new Set(prev); n.delete(msg.id); return n; })} className="mt-2 text-[11px] font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                              Show less
                            </button>
                          )}
                        </div>
                      )}
                      {(liveThoughts[msg.id] || msg.thoughts) && (
                        <ThinkingPanel
                          thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                          isLive={!!liveThoughts[msg.id]}
                          isExpanded={showThoughts.has(msg.id)}
                          onToggle={() => setShowThoughts(prev => {
                            const n = new Set(prev);
                            n.has(msg.id) ? n.delete(msg.id) : n.add(msg.id);
                            return n;
                          })}
                        />
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, si) => {
                              const url = typeof src === 'string' ? src : (src as any).url || src;
                              const title = typeof src === 'string' ? url : (src as any).title || `Source ${si + 1}`;
                              return (
                                <a key={si} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition-colors hover:opacity-80" style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.15)' }}>
                                  <span className="citation-badge relative" style={{ width: 16, height: 16, fontSize: 9 }}>{si + 1}</span>
                                  <span className="max-w-[160px] truncate">{title}</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {msg.attachments?.filter(a => !a.preview).map(att => (
                        <div key={att.name} className="mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <Paperclip size={10} /> {att.name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </MessageContextMenu>
            </div>
          </motion.div>
        ))}

        {useGiaStore.getState().clarification && (() => {
          const c = useGiaStore.getState().clarification!;
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center px-4 py-3 mx-4 rounded-2xl"
              style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
            >
              <p className="text-xs font-medium mb-2.5 text-center leading-relaxed" style={{ color: 'var(--gia-text)' }}>{c.question}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {c.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleClarificationAnswer(opt)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-medium transition-all tap-feedback disabled:opacity-40"
                    style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          );
        })()}
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute right-4 bottom-32 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 bg-zinc-800 border border-zinc-700">
            <ChevronDown size={14} className="text-zinc-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {loading && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleStop}
          className="absolute right-4 bottom-[84px] w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 transition-colors"
          style={{ background: '#7c3aed', border: '1px solid rgba(168,85,247,0.4)' }}
        >
          <Square size={12} className="text-white" />
        </motion.button>
      )}

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

        <div ref={inputContainerRef} className="px-3 pb-4 pt-2 absolute bottom-3 left-3 right-3 z-10 backdrop-blur-2xl rounded-2xl border shadow-2xl transition-all duration-300" style={{ background: messages.length === 0 ? 'rgba(10,10,15,0.7)' : 'rgba(10,10,15,0.2)', borderColor: messages.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.04)' }}>
        <input ref={fileRef} type="file" className="hidden" multiple onChange={e => handleFile(e)} accept=".txt,.md,.pdf,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log,.env" />
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

        <div className="flex items-center gap-1.5 mb-2.5">
          <button 
            onClick={() => setShowTools(!showTools)}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors tap-feedback"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
          >
            <motion.div animate={{ rotate: showTools ? 90 : 0 }}>
              <ChevronRight size={14} />
            </motion.div>
          </button>

          <div className="flex-1 overflow-hidden flex items-center gap-2">
            <AnimatePresence initial={false} mode="wait">
              {showTools ? (
                <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1"
                >
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
                  <Paperclip size={11} /> File
                </button>
                <button onClick={() => imgRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
                  <ImageIcon size={11} /> Photo
                </button>
                <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />
                {[
                  { label: 'Search', feature: 'webSearch' as const, icon: Globe, active: webSearch, color: '#3b82f6' },
                  { label: 'Think', feature: 'extThinking' as const, icon: Brain, active: extThinking, color: '#f59e0b' },
                  { label: 'Hands-off', feature: 'handsOff' as const, icon: Zap, active: handsOff, color: '#a855f7' },
                  { label: 'Listen', feature: 'listen' as const, icon: Headphones, active: voiceEnabled, color: '#ec4899' },
                ].map((tool) => (
                  <button key={tool.label} onClick={() => toggleFeature(tool.feature)} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback shrink-0" style={{ background: tool.active ? `${tool.color}20` : 'var(--gia-surface)', border: `1px solid ${tool.active ? `${tool.color}40` : 'var(--gia-border)'}`, color: tool.active ? tool.color : 'var(--gia-muted)', fontWeight: 500 }}>
                    <tool.icon size={11} />
                    {tool.label}
                  </button>
                ))}
                </motion.div>

              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex -space-x-1.5">
                    {webSearch && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-blue-500/20 text-blue-400"><Globe size={10} /></div>}
                    {extThinking && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-amber-500/20 text-amber-400"><Brain size={10} /></div>}
                    {handsOff && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-purple-500/20 text-purple-400"><Zap size={10} /></div>}
                  </div>
                  {isSyncing && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                    {isSyncing ? 'Syncing...' : (!webSearch && !extThinking && !handsOff) ? 'No active tools' : 'Tools active'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* Floating stop button */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex justify-center pb-2"
            >
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all shadow-lg"
                style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}
              >
                <Square size={12} className="fill-white" /> Stop generating
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AmbientInput value={input} onChange={handleInputChange} onSubmit={handleSend} onStop={loading ? handleStop : undefined} isLoading={loading} onVoiceToggle={() => toggleFeature('listen')} isVoiceListening={voiceEnabled} placeholder={webSearch ? 'Ask anything — I\'ll search the web…' : handsOff ? 'GIA has control — ask and it acts…' : 'Message GIA…'} />
      </div>

      <AnimatePresence>
        {showSkillPicker && (
          <SkillPicker 
            skills={skills}
            activeSkillId={activeSkillId || 'core-general'}
            onSelect={(skillId) => {
              setSkill(skillId);
              setShowSkillPicker(false);
              setInput('');
              addNotification(`Skill active: ${skills.find((s: Skill) => s.id === skillId)?.name}`);
            }}
            onClose={() => setShowSkillPicker(false)}
          />
        )}
      </AnimatePresence>
      {showKnowledge && <KnowledgePanel onClose={() => setShowKnowledge(false)} />}
      <GiaConsole
        logs={consoleLogs}
        isVisible={showConsole}
        onClose={() => setShowConsole(false)}
      />
    </div>
  );
};

export default React.memo(ChatModule);
