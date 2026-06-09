import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from '../services/ProviderRegistry';
import { useProtocolStore } from '../store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useVoiceInput } from './useVoiceInput';
import { useFileAttachments } from './useFileAttachments';
import type { Attachment } from './useFileAttachments';
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
    localVision, setLocalVision,
    skills, activeSkillId, setSkill,
    wakeWord, thinkingPhase, setThinkingPhase,
    keepListening,
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
    localVision: s.localVision, setLocalVision: s.setLocalVision,
    skills: s.skills, activeSkillId: s.activeSkillId, setSkill: s.setSkill,
    wakeWord: s.wakeWord, thinkingPhase: s.thinkingPhase, setThinkingPhase: s.setThinkingPhase,
    keepListening: s.keepListening, setKeepListening: s.setKeepListening,
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
    voiceLanguage,
  } = useVoiceInput(gen.abortTimeoutRef);

  const {
    attachments, setAttachments, isDragging, dragCounter,
    processingFiles, processingFileName,
    addFiles, handleFile, handlePaste,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    removeAttachment,
  } = useFileAttachments(activeModel, activeProvider, providerLabel);

  const toggleFeature = useCallback((feature: 'webSearch' | 'extThinking' | 'handsOff' | 'listen' | 'vision') => {
    if (feature === 'webSearch') setWebSearch(!webSearch);
    if (feature === 'extThinking') setExtThinking(!extThinking);
    if (feature === 'handsOff') setHandsOff(!handsOff);
    if (feature === 'vision') setLocalVision(!localVision);
    if (feature === 'listen') {
      const newState = !voiceEnabled;
      setVoiceEnabled(newState);
      if (newState) voiceRef.current.startListening();
      else voiceRef.current.stopListening();
    }
  }, [setWebSearch, setExtThinking, setHandsOff, setLocalVision, setVoiceEnabled, webSearch, extThinking, handsOff, localVision, voiceEnabled, voiceRef]);

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

  // Circle-to-search: watch for pending image from screen region capture
  useEffect(() => {
    const pending = useGiaStore.getState().pendingCircleImage;
    if (!pending) return;

    const attachment: Attachment = { name: 'screen-region.png', type: 'image/png', content: '', preview: pending };
    setAttachments(prev => [...prev, attachment]);
    setInput('What is in this area?');
    useGiaStore.getState().setPendingCircleImage(null);

    const t = setTimeout(() => {
      if (input.trim() || pending) {
        gen.handleSend('What is in this area?', [...attachments, attachment], setInput, v => setAttachments(v as Attachment[]));
      }
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Share target: watch for pending input/files from PWA share target
  useEffect(() => {
    const pendingInput = useGiaStore.getState().pendingInput;
    const pendingFiles = useGiaStore.getState().pendingFiles;
    if (!pendingInput && pendingFiles.length === 0) return;

    if (pendingInput) {
      setInput(pendingInput);
      useGiaStore.getState().setPendingInput(null);
    }
    if (pendingFiles.length > 0) {
      setAttachments(prev => [...prev, ...pendingFiles.map(f => ({ name: f.name, type: f.type, content: f.content || '', preview: f.preview }))]);
      useGiaStore.getState().setPendingFiles([]);
    }
  }, []);

  // Pending action: handle deep links, file opens, and other external intents
  useEffect(() => {
    const action = useGiaStore.getState().pendingAction;
    if (!action) return;

    if (action.type === 'deep-link') {
      const url = action.data?.url || '';
      setInput(`Handle this link: ${url}`);
      useGiaStore.getState().addNotification(`🔗 Deep link ready to process: ${url.slice(0, 50)}`);
    } else if (action.type === 'file-open') {
      const file = action.data;
      if (file) {
        const attachment: Attachment = { name: file.name, type: file.type, content: file.content || '', preview: undefined };
        setAttachments(prev => [...prev, attachment]);
        setInput(`Analyze this file: ${file.name}`);
        useGiaStore.getState().addNotification(`📄 Opened ${file.name}`);
      }
    }

    useGiaStore.getState().setPendingAction(null);
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
    gen.handleSend(input, attachments, setInput, v => setAttachments(v as Attachment[]));
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
    clarAnswer, setClarAnswer, processingFiles, processingFileName, isDragging,
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
    handsOff, setHandsOff,
    localVision, setLocalVision,
    skills, activeSkillId, setSkill,
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
