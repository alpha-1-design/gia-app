import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from '../services/ProviderRegistry';
import { useProtocolStore } from '../store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useVoiceInput } from './useVoiceInput';
import { useFileAttachments } from './useFileAttachments';
import { useChatGeneration } from './useChatGeneration';
import { useChatMessages } from './useChatMessages';

export function useChatState() {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [showThoughts, setShowThoughts] = useState<Set<string>>(new Set());
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [clarAnswer, setClarAnswer] = useState('');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [inputContainerHeight, setInputContainerHeight] = useState(140);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const gen = useChatGeneration();
  const msgOps = useChatMessages();

  const {
    sessions,
    activeSessionId, createSession, setActiveSession,
    addMessage, updateMessage, deleteSession,
    forkSession, clearSession, getActiveSession,
    getBranchMessages, switchBranch, addBranch, renameBranch, deleteBranch, getAllBranchIds,
    userProfile, setIntentState, addNotification,
    setShowConsole, showConsole, consoleLogs,
    webSearch, setWebSearch,
    extThinking, setExtThinking,
    handsOff, setHandsOff,
    skills, activeSkillId, setSkill,
    wakeWord, thinkingPhase, setThinkingPhase
  } = useGiaStore(useShallow(s => ({
    sessions: s.sessions,
    activeSessionId: s.activeSessionId, createSession: s.createSession, setActiveSession: s.setActiveSession,
    addMessage: s.addMessage, updateMessage: s.updateMessage, deleteSession: s.deleteSession,
    forkSession: s.forkSession, clearSession: s.clearSession,
    getActiveSession: s.getActiveSession, getBranchMessages: s.getBranchMessages, switchBranch: s.switchBranch,
    addBranch: s.addBranch, renameBranch: s.renameBranch, deleteBranch: s.deleteBranch, getAllBranchIds: s.getAllBranchIds,
    userProfile: s.userProfile,
    setIntentState: s.setIntentState, addNotification: s.addNotification,
    setShowConsole: s.setShowConsole, showConsole: s.showConsole, consoleLogs: s.consoleLogs,
    webSearch: s.webSearch, setWebSearch: s.setWebSearch,
    extThinking: s.extThinking, setExtThinking: s.setExtThinking,
    handsOff: s.handsOff, setHandsOff: s.setHandsOff,
    skills: s.skills, activeSkillId: s.activeSkillId, setSkill: s.setSkill,
    wakeWord: s.wakeWord, thinkingPhase: s.thinkingPhase, setThinkingPhase: s.setThinkingPhase,
  })));

  const { providers, activeProvider } = useProviderStore(useShallow(s => ({
    providers: s.providers,
    activeProvider: s.activeProvider,
  })));
  const activeProtocols = useProtocolStore(useShallow(s => s.protocols.filter(p => p.state !== 'confirmed' && p.state !== 'modified')));
  const providerLabel = providerRegistry.getLabel(activeProvider);
  const providerConnected = providers[activeProvider]?.enabled ?? false;
  const activeModel = providers[activeProvider]?.model ?? '';
  const activeSession = getActiveSession();
  const messages = useMemo(() => {
    if (!activeSession) return [];
    return getBranchMessages(activeSession.id, activeSession.currentBranchId);
  }, [activeSession, getBranchMessages]);

  const {
    voiceEnabled, setVoiceEnabled, voiceRef, keepListeningRef,
    voiceLanguage, keepListening,
  } = useVoiceInput(gen.abortTimeoutRef);

  const {
    attachments, setAttachments, isDragging, dragCounter,
    addFiles, handleFile, handlePaste,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    removeAttachment,
  } = useFileAttachments(activeModel, activeProvider, providerLabel);

  const toggleFeature = useCallback((feature: 'webSearch' | 'extThinking' | 'handsOff' | 'listen') => {
    if (feature === 'webSearch') setWebSearch(!webSearch);
    if (feature === 'extThinking') setExtThinking(!extThinking);
    if (feature === 'handsOff') setHandsOff(!handsOff);
    if (feature === 'listen') {
      const newState = !voiceEnabled;
      setVoiceEnabled(newState);
      if (newState) voiceRef.current.startListening();
      else voiceRef.current.stopListening();
    }
  }, [setWebSearch, setExtThinking, setHandsOff, setVoiceEnabled, webSearch, extThinking, handsOff, voiceEnabled, voiceRef]);

  useEffect(() => { if (!activeSessionId) createSession(); }, [activeSessionId, createSession]);

  // Desktop notification + response time tracking
  useEffect(() => {
    if (!gen.loading && gen.responseStartRef.current > 0 && gen.streamingMsgId) {
      const elapsed = Date.now() - gen.responseStartRef.current;
      gen.responseTimesRef.current[gen.streamingMsgId] = elapsed;
      gen.responseStartRef.current = 0;
    }
    if (gen.lastUserMsgRef.current && typeof document !== 'undefined' && document.hidden) {
      const msg = gen.lastUserMsgRef.current;
      gen.lastUserMsgRef.current = '';
      import('../services/DesktopNotifications').then(m =>
        m.default.notifyOnComplete('GIA Response Ready', msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
      );
    }
  }, [gen.loading, gen.streamingMsgId]);

  // Abort in-flight requests on unmount
  useEffect(() => () => { gen.abortRef.current?.abort(); if (gen.abortTimeoutRef.current) clearTimeout(gen.abortTimeoutRef.current); }, []);

  useEffect(() => {
    const el = inputContainerRef.current;
    if (!el) return;
    const updateHeight = () => setInputContainerHeight(el.offsetHeight + 48);
    updateHeight();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setInputContainerHeight(entry.contentRect.height + 48);
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
    if (messages.length !== prevMsgCount.current || gen.loading) {
      prevMsgCount.current = messages.length;
      scrollToBottom();
    }
  }, [messages, gen.loading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gen.loading) gen.handleStop();
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'l' || e.code.toLowerCase() === 'keyl')) {
        e.preventDefault();
        toggleFeature('listen');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gen.loading, gen.handleStop, toggleFeature]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (value === '/') setShowSkillPicker(true);
  }, []);

  const handleSend = useCallback(() => {
    if (input.trim() === '/') {
      setShowSkillPicker(true);
      setInput('');
      return;
    }
    if (input.trim().startsWith('/')) {
      setShowSkillPicker(true);
      return;
    }
    gen.handleSend(input, attachments, setInput, v => setAttachments(v as unknown[]));
  }, [input, attachments, gen.handleSend]);

  const handleEditResend = useCallback((msgId: string) => {
    msgOps.handleEditResend(msgId, setInput);
  }, [msgOps.handleEditResend]);

  return {
    input, setInput,
    loading: gen.loading, streamingMsgId: gen.streamingMsgId,
    voiceEnabled, setVoiceEnabled, showHistory, setShowHistory,
    historySearch, setHistorySearch, attachments, setAttachments,
    copiedId: msgOps.copiedId,
    showScrollBtn, setShowScrollBtn,
    undoMsg: msgOps.undoMsg, setUndoMsg: msgOps.setUndoMsg,
    showSkillPicker, setShowSkillPicker,
    expandedMsgs, setExpandedMsgs, showThoughts, setShowThoughts,
    liveThoughts: gen.liveThoughts, setLiveThoughts: gen.setLiveThoughts,
    showKnowledge, setShowKnowledge,
    clarAnswer, setClarAnswer, isDragging,
    showFileBrowser, setShowFileBrowser, showTools, setShowTools,
    inputContainerHeight, setInputContainerHeight,
    keepListeningRef, voiceRef, dragCounter, undoTimeoutRef: msgOps.undoTimeoutRef,
    abortRef: gen.abortRef, abortTimeoutRef: gen.abortTimeoutRef,
    copyTimeoutRef: msgOps.copyTimeoutRef,
    responseStartRef: gen.responseStartRef,
    responseTimesRef: gen.responseTimesRef,
    lastUserMsgRef: gen.lastUserMsgRef, fileRef, imgRef, scrollRef,
    inputContainerRef,
sessions, activeSessionId, createSession, setActiveSession,
    addMessage, updateMessage, deleteSession, forkSession,
    clearSession, getActiveSession, getBranchMessages, switchBranch,
    addBranch, renameBranch, deleteBranch, getAllBranchIds,
    userProfile, setIntentState,
    addNotification, setShowConsole, showConsole, consoleLogs,
    webSearch, setWebSearch, extThinking, setExtThinking,
    handsOff, setHandsOff, skills, activeSkillId, setSkill,
    wakeWord, thinkingPhase, setThinkingPhase,
    providers, activeProvider, activeProtocols,
    keepListening, voiceLanguage, activeSession, messages,
    providerLabel, providerConnected, activeModel,
    toggleFeature, handleStop: gen.handleStop,
    handleContinue: gen.handleContinue,
    handleDeleteWithUndo: msgOps.handleDeleteWithUndo,
    handleUndoDelete: msgOps.handleUndoDelete,
    handleInputChange, handleSend,
    handleClarificationAnswer: gen.handleClarificationAnswer,
    addFiles, handlePaste, handleDragEnter, handleDragLeave,
    handleDragOver, handleDrop, handleFork: msgOps.handleFork,
    handleEditResend, handleRetry: gen.handleRetry,
    handleScroll, scrollToBottom, handleFile, removeAttachment,
    copyMessage: msgOps.copyMessage, exportChat: msgOps.exportChat,
    showBranchView: msgOps.showBranchView, setShowBranchView: msgOps.setShowBranchView,
    handleCreateBranch: msgOps.handleCreateBranch,
  };
}
