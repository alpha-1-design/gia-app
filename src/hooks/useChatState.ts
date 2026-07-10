import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { useDraftStore } from '../store/useDraftStore';
import { useAgentStore } from '../store/useAgentStore';
import { useProviderStore } from '../store/useProviderStore';
import { providerRegistry } from '../services/ProviderRegistry';
import { useProtocolStore } from '../store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import { useVoiceInput } from './useVoiceInput';
import { useFileAttachments } from './useFileAttachments';
import type { Attachment } from './useFileAttachments';
import { useChatGeneration } from './useChatGeneration';
import { useChatMessages } from './useChatMessages';
import AnalyticsService from '../services/AnalyticsService';
import { AudioRecorder } from '../services/audioRecorder';
import WhisperService from '../services/WhisperService';

export function useChatState() {
  // Lazy-init from whatever session was active last time this hook mounted, so a
  // draft typed before switching modules (which unmounts ChatModule) survives the
  // round trip. Falls back to '' the very first time there's no session yet.
  const [input, setInputRaw] = useState<string>(() => {
    const sid = useGiaStore.getState().activeSessionId;
    return sid ? useDraftStore.getState().getDraft(sid) : '';
  });
  const currentSessionIdRef = useRef<string | null>(useGiaStore.getState().activeSessionId ?? null);

  // Keep local input state in sync with the persisted draft for whichever
  // session is active, and persist keystrokes as they happen.
  const setInput = useCallback((value: string) => {
    setInputRaw(value);
    useDraftStore.getState().setDraft(currentSessionIdRef.current, value);
  }, []);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [showThoughts, setShowThoughts] = useState<Set<string>>(new Set());
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [clarAnswer, setClarAnswer] = useState('');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [inputContainerHeight, setInputContainerHeight] = useState(140);
  const [showAgentMention, setShowAgentMention] = useState(false);
  const [agentMentionQuery, setAgentMentionQuery] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const audioRecorderRef = useRef(new AudioRecorder());

  const gen = useChatGeneration();
  const genRef = useRef(gen);
  genRef.current = gen;
  const msgOps = useChatMessages();
  const editingAssistIdRef = useRef<string | null>(null);

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
    localTranslate, setLocalTranslate,
    skills, activeSkillId, setSkill,
    wakeWord, thinkingPhase, setThinkingPhase,
    keepListening, currentTool,
    pendingAction,
    clarification, setClarification,
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
    localTranslate: s.localTranslate, setLocalTranslate: s.setLocalTranslate,
    skills: s.skills, activeSkillId: s.activeSkillId, setSkill: s.setSkill,
    wakeWord: s.wakeWord, thinkingPhase: s.thinkingPhase, setThinkingPhase: s.setThinkingPhase,
    keepListening: s.keepListening, setKeepListening: s.setKeepListening,
    currentTool: s.currentTool,
    clarification: s.clarification, setClarification: s.setClarification,
    pendingAction: s.pendingAction,
  })));

  // When the active session changes (new chat, switched chat, or coming back
  // from another module after a session change elsewhere), swap the composer
  // draft to match: stash whatever was typed for the old session, load
  // whatever was saved for the new one.
  useEffect(() => {
    if (currentSessionIdRef.current === activeSessionId) return;
    currentSessionIdRef.current = activeSessionId ?? null;
    setInputRaw(activeSessionId ? useDraftStore.getState().getDraft(activeSessionId) : '');
  }, [activeSessionId]);

  const { providers, activeProvider } = useProviderStore(useShallow(s => ({
    providers: s.providers,
    activeProvider: s.activeProvider,
  })));
  const protocols = useProtocolStore(s => s.protocols);
  const activeProtocols = useMemo(() => protocols.filter(p => p.state !== 'confirmed' && p.state !== 'modified'), [protocols]);
  const providerLabel = providerRegistry.getLabel(activeProvider);
  const providerConnected = providers[activeProvider]?.enabled ?? false;
  const activeModel = providers[activeProvider]?.model ?? '';
  const activeSession = getActiveSession();
  const messages = useMemo(() => {
    if (!activeSession) return [];
    return getBranchMessages(activeSession.id, activeSession.currentBranchId);
  }, [activeSession, getBranchMessages]);

  const {
    attachments, setAttachments, isDragging, dragCounter,
    processingFiles, processingFileName,
    addFiles, handleFile, handlePaste,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    removeAttachment,
  } = useFileAttachments();
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const setAttachmentsRef = useRef(setAttachments);
  setAttachmentsRef.current = setAttachments;

  const {
    voiceEnabled, setVoiceEnabled, voiceRef, keepListeningRef,
    voiceLanguage,
  } = useVoiceInput(
    gen.abortTimeoutRef,
    useCallback((text: string) => {
      genRef.current.handleSend(text, attachmentsRef.current, setInput, v => setAttachmentsRef.current(v as Attachment[]));
    }, [setInput]),
    setInput,
  );

  const toggleFeature = useCallback((feature: 'webSearch' | 'extThinking' | 'handsOff' | 'listen' | 'vision' | 'translate') => {
    let newFeatureState: boolean | undefined;
    if (feature === 'webSearch') { setWebSearch(!webSearch); newFeatureState = !webSearch; }
    if (feature === 'extThinking') { setExtThinking(!extThinking); newFeatureState = !extThinking; }
    if (feature === 'handsOff') { setHandsOff(!handsOff); newFeatureState = !handsOff; }
    if (feature === 'vision') { setLocalVision(!localVision); newFeatureState = !localVision; }
    if (feature === 'translate') { setLocalTranslate(!localTranslate); newFeatureState = !localTranslate; }
    if (feature === 'listen') {
      const newState = !voiceEnabled;
      setVoiceEnabled(newState);
      newFeatureState = newState;

      const useWhisper = useGiaStore.getState().useWhisper;

      if (useWhisper) {
        if (newState) {
          audioRecorderRef.current.start().catch(() => setVoiceEnabled(false));
        } else {
          audioRecorderRef.current.stop().then(async (blob) => {
            if (blob.size < 1000) return;
            if (!WhisperService.isReady) {
              addNotification('Loading Whisper model…');
              await WhisperService.loadModel();
            }
            addNotification('Transcribing…');
            const text = await WhisperService.transcribe(blob);
            if (text) {
              genRef.current.handleSend(text, attachmentsRef.current, setInput, v => setAttachmentsRef.current(v as Attachment[]));
            }
          }).catch(() => {});
        }
      } else {
        if (newState) {
          voiceRef.current.startListening(true);
        } else {
          voiceRef.current.stopListening();
        }
      }
    }
    if (newFeatureState !== undefined) AnalyticsService.trackFeature(feature, newFeatureState);
  }, [setWebSearch, setExtThinking, setHandsOff, setLocalVision, setLocalTranslate, setVoiceEnabled, webSearch, extThinking, handsOff, localVision, localTranslate, voiceEnabled, voiceRef, setInput, addNotification]);

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
  }, [gen.loading, gen.streamingMsgId, gen.responseStartRef, gen.responseTimesRef, gen.lastUserMsgRef]);


  // Module switch is handled by store-level generation tracking — request continues
  // so responses don't hang when user navigates away.

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

    const overlayText = useGiaStore.getState().pendingInput || '';
    useGiaStore.getState().setPendingInput(null);

    const query = overlayText || 'What is in this area?';
    const attachment: Attachment = { name: 'screen-region.png', type: 'image/png', content: '', preview: pending };
    setAttachments(prev => [...prev, attachment]);
    setInput(query);
    useGiaStore.getState().setPendingCircleImage(null);

    const t = setTimeout(() => {
      if (input.trim() || pending) {
        gen.handleSend(query, [...attachments, attachment], setInput, v => setAttachments(v as Attachment[]));
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

      // Auto-send for hands-free voice commands from overlay
      setTimeout(() => {
        const curInput = useGiaStore.getState().pendingInput;
        useGiaStore.getState().setPendingInput(null);
        if (curInput || pendingInput) {
          gen.handleSend(pendingInput, attachments, setInput, v => setAttachments(v as Attachment[]));
        }
      }, 400);
    }
    if (pendingFiles.length > 0) {
      setAttachments(prev => [...prev, ...pendingFiles.map(f => ({ name: f.name, type: f.type, content: f.content || '', preview: f.preview }))]);
      useGiaStore.getState().setPendingFiles([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending action: handle deep links, file opens, and other external intents
  useEffect(() => {
    const action = useGiaStore.getState().pendingAction;
    if (!action) return;

    if (action.type === 'deep-link') {
      const url = (action.data?.url as string) || '';
      setInput(`Handle this link: ${url}`);
      useGiaStore.getState().addNotification(`🔗 Deep link ready to process: ${url.slice(0, 50)}`);
    } else if (action.type === 'file-open') {
      const file = action.data as { name?: string; type?: string; content?: string } | undefined;
      if (file?.name) {
        const attachment: Attachment = { name: file.name, type: file.type || '', content: file.content || '', preview: undefined };
        setAttachments(prev => [...prev, attachment]);
        setInput(`Analyze this file: ${file.name}`);
        useGiaStore.getState().addNotification(`📄 Opened ${file.name}`);
      }
    } else if (action.type === 'shared-image') {
      const uri = action.data?.uri as string;
      const mimeType = (action.data?.mimeType as string) || 'image/png';
      if (uri) {
        const attachment: Attachment = { name: 'shared-image', type: mimeType, content: '', preview: uri };
        setAttachments(prev => [...prev, attachment]);
        setInput('Analyze this image');
        useGiaStore.getState().addNotification('📷 Image received');
      }
    } else if (action.type === 'send-message') {
      const text = (action.data?.text as string) || '';
      if (text) {
        setInput(text);
        useGiaStore.getState().setPendingAction(null);
        setTimeout(() => genRef.current.handleSend(text, [], (v) => setInput(v), (v) => setAttachmentsRef.current(v as Attachment[])), 50);
        return;
      }
    } else if (action.type === 'assist') {
      useGiaStore.getState().setModule('chat');
      setTimeout(() => { voiceRef.current?.startListening(true); }, 300);
    }

    useGiaStore.getState().setPendingAction(null);
  }, [setAttachments, pendingAction, voiceRef, setInput]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.loading, gen.handleStop, toggleFeature]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (value === '/') setShowSkillPicker(true);

    // Detect @-mention for agents
    const atIdx = value.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || value[atIdx - 1] === ' ')) {
      const afterAt = value.slice(atIdx + 1);
      // Only show if no space after @ (user is still typing the name)
      if (!afterAt.includes(' ')) {
        setShowAgentMention(true);
        setAgentMentionQuery(afterAt);
        return;
      }
    }
    setShowAgentMention(false);
    setAgentMentionQuery('');
  }, []);

  const handleAgentMentionSelect = useCallback((agentId: string, agentName: string, task?: string) => {
    const atIdx = input.lastIndexOf('@');
    if (atIdx >= 0) {
      const beforeAt = input.slice(0, atIdx);
      // Task-carrying mention syntax: @Name{specific task}. Keeps each
      // agent's instruction distinct instead of every mentioned agent
      // silently sharing the same free-text blob.
      const mentionText = task ? `@${agentName}{${task}} ` : `@${agentName} `;
      setInput(`${beforeAt}${mentionText}`);
    }
    setShowAgentMention(false);
    setAgentMentionQuery('');
  }, [input]);

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

    const editAsstId = editingAssistIdRef.current;
    if (editAsstId) {
      editingAssistIdRef.current = null;
      const state = useGiaStore.getState();
      const msgs = state.getActiveSession()?.messages ?? [];
      const asstIdx = msgs.findIndex(m => m.message.id === editAsstId);
      if (asstIdx > 0) {
        const userMsgId = msgs[asstIdx - 1].message.id;
        const ids = [userMsgId, editAsstId];
        useGiaStore.setState({
          sessions: state.sessions.map(s =>
            s.id === state.activeSessionId
              ? { ...s, messages: s.messages.filter(m => !ids.includes(m.message.id)), updatedAt: Date.now() }
              : s
          ),
        });
      }
    }

    setShowAgentMention(false);

    // Parse @mentions and resolve agents. Supports two forms:
    //   @Name{specific task}  — explicit, agent-specific instruction
    //   @Name                 — falls back to the shared message text (legacy behavior)
    const agents = useAgentStore.getState().agents;
    const mentionedAgents: { id: string; name: string; icon: string; task?: string }[] = [];
    let cleanedInput = input;
    for (const a of agents) {
      const taskPattern = new RegExp(`@${a.name}\\{([^}]*)\\}`);
      const taskMatch = cleanedInput.match(taskPattern);
      if (taskMatch) {
        mentionedAgents.push({ id: a.id, name: a.name, icon: a.icon, task: taskMatch[1].trim() });
        cleanedInput = cleanedInput.replace(taskMatch[0], '').trim();
        continue;
      }
      const plainPattern = `@${a.name}`;
      if (cleanedInput.includes(plainPattern)) {
        mentionedAgents.push({ id: a.id, name: a.name, icon: a.icon });
        cleanedInput = cleanedInput.replace(plainPattern, '').trim();
      }
    }

    gen.handleSend(input, attachments, setInput, v => setAttachments(v as Attachment[]), mentionedAgents, cleanedInput || input);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, attachments, gen.handleSend, setAttachments]);

  const handleEditResend = useCallback((msgId: string) => {
    editingAssistIdRef.current = msgId;
    msgOps.handleEditResend(msgId, setInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgOps.handleEditResend]);

  return {
    input, setInput,
    loading: gen.loading, streamingMsgId: gen.streamingMsgId, streamingMsgIds: gen.streamingMsgIds,
    showAgentMention, setShowAgentMention, agentMentionQuery,
    handleAgentMentionSelect,
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
    showFileBrowser, setShowFileBrowser, showFileManager, setShowFileManager, showTools, setShowTools,
    inputContainerHeight, setInputContainerHeight,
    keepListeningRef, voiceRef, dragCounter, undoTimeoutRef: msgOps.undoTimeoutRef,
    abortTimeoutRef: gen.abortTimeoutRef,
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
    localTranslate, setLocalTranslate,
    skills, activeSkillId, setSkill,
    wakeWord, thinkingPhase, setThinkingPhase, currentTool,
    clarification, setClarification,
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
