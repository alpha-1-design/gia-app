import React from 'react';
import { createPortal } from 'react-dom';
import {
  Bot, Plus, History, Trash2,
  Paperclip, X, Download, Globe, Image as ImageIcon, Camera, Terminal,
  Brain, ChevronDown, Sparkles, GraduationCap, Code2,
  BookOpen, Zap, Undo2, Search, Headphones, GitBranch,
  Eye, Loader2, Upload, LayoutTemplate, Languages, Hammer, RotateCcw, Archive, Radar, SlidersHorizontal, Wrench,
  Maximize2, ChevronRight, Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGiaStore } from '../store/useGiaStore';
import { useProtocolStore } from '../store/useProtocolStore';
import { useSearchActivity } from '../store/useSearchActivity';
import { useChatState } from '../hooks/useChatState';
import { useProactiveMessage } from '../hooks/useProactiveMessage';
import GiaIcon from '../components/GiaIcon';
import giaTools from '../services/GiaTools';
import SandboxEnvService from '../services/SandboxEnvService';
import MessageList from '../components/MessageList';
import ComposerToolsSheet from '../components/ComposerToolsSheet';
import AmbientInput from '../components/AmbientInput';
import SkillPicker from '../components/SkillPicker';
import BuildPreviewSheet from '../components/BuildPreviewSheet';
import { KnowledgePanel } from '../components/KnowledgePanel';
import FileManager from '../components/FileManager';
import ToolTray from '../components/ToolTray';
import { ClarificationBottomSheet } from '../components/chat/ClarificationBottomSheet';
import { EngineSheet } from '../components/chat/EngineSheet';
import ModelSwitcherSheet from '../components/chat/ModelSwitcherSheet';
import ToolsCatalogSheet from '../components/chat/ToolsCatalogSheet';
import ProviderIcon from '../components/ProviderIcon';
import { BranchView } from '../components/chat/BranchView';
import { SummaryBanner } from '../components/chat/SummaryBanner';
import AgentMentionPicker from '../components/AgentMentionPicker';
import { useProviderStore } from '../store/useProviderStore';
import AgentSwarmDashboard from '../components/AgentSwarmDashboard';
import { TemplateSelector } from '../components/TemplateSelector';
import { LiveFileEditor } from '../components/LiveFileEditor';

const QUICK_STARTS = [
  { icon: GraduationCap, label: 'Exam Prep', prompt: 'Quiz me on WASSCE past questions for', color: '#a855f7', category: 'study' },
  { icon: BookOpen, label: 'BECE Prep', prompt: 'Help me study for BECE — topic:', color: '#3b82f6', category: 'study' },
  { icon: Code2, label: 'Code Help', prompt: 'Explain and fix this code:', color: '#ec4899', category: 'code' },
  { icon: Sparkles, label: 'Summarize URL', prompt: 'Summarize this URL: https://', color: '#10b981', category: 'tools' },
  { icon: Zap, label: 'Plan My Week', prompt: 'Help me plan my study week. My exams are:', color: '#f59e0b', category: 'productivity' },
];

const LOCALHOST_RE = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}))(:\d+)?(\/[^\s<]*)?/i;
const extractLocalhostUrl = (text: string): string | null => {
  const m = text?.match(LOCALHOST_RE);
  return m ? m[0] : null;
};

interface ChatModuleProps {
  /** Force Build Mode on — used by the dedicated Build module wrapper. */
  build?: boolean;
}

const ChatModule: React.FC<ChatModuleProps> = ({ build: forceBuild }) => {
  const {
    input, setInput, loading, streamingMsgId, streamingMsgIds, voiceEnabled,
    showHistory, setShowHistory, historySearch, setHistorySearch, attachments,
    processingFiles, processingFileName,
    showScrollBtn, undoMsg, showSkillPicker,
    expandedMsgs, setExpandedMsgs, showThoughts, setShowThoughts,
    liveThoughts, liveSegments, showKnowledge, setShowKnowledge,
    isDragging, showFileManager, setShowFileManager, showTools,
    inputContainerHeight,
    scrollRef, inputContainerRef, fileRef, imgRef,
    responseTimesRef, clarAnswer, setClarAnswer,
    activeSessionId, setActiveSession, sessions,
    createSession, deleteSession,
    addNotification,
    webSearch, deepSearch, extThinking, handsOff,
    localVision, localTranslate,
    activeSkillId, setSkill,
    skills, thinkingPhase, currentTool,
    messages, activeSession, providerConnected, providerLabel,
    activeModel,
    toggleFeature, handleStop, handleUndoDelete,
    handleInputChange, handleSend, sendText, handleClarificationAnswer,
    handleDeleteWithUndo, handleContinue, handleFork, handleRetry, handleRewrite, handleEditResend,
    handlePaste, handleDragEnter, handleDragLeave,
    handleDragOver, handleDrop, handleFile, removeAttachment, addFiles,
    copyMessage, scrollToBottom, handleScroll, exportChat,
    setShowSkillPicker, setShowTools,
    showBranchView, setShowBranchView,
    clarification, setClarification,
    showAgentMention, agentMentionQuery, handleAgentMentionSelect,
    liveFileEdit, setLiveFileEdit,
  } = useChatState();

  const buildModeStore = useGiaStore((s) => s.buildMode);
  const buildMode = forceBuild ?? buildModeStore;
  const setBuildMode = useGiaStore((s) => s.setBuildMode);
  const buildPreviewUrl = useGiaStore((s) => s.buildPreviewUrl);
  const setBuildPreview = useGiaStore((s) => s.setBuildPreview);
  const sandboxEnvReady = useGiaStore((s) => s.sandboxEnvReady);
  const archivedSessions = useGiaStore((s) => s.archivedSessions);
  const restoreSession = useGiaStore((s) => s.restoreSession);
  const userProfile = useGiaStore((s) => s.userProfile);
  const activeProvider = useProviderStore((s) => s.activeProvider);

  const toolItems: { key: 'webSearch' | 'deepSearch' | 'extThinking' | 'handsOff' | 'listen' | 'vision' | 'translate'; label: string; icon: React.ComponentType<{ size?: number }>; active: boolean; color: string }[] = [
    { key: 'webSearch', label: 'Web Search', icon: Globe, active: webSearch, color: '#3b82f6' },
    { key: 'deepSearch', label: 'DeepSearch', icon: Radar, active: deepSearch, color: '#22d3ee' },
    { key: 'extThinking', label: 'Think', icon: Brain, active: extThinking, color: '#f59e0b' },
    { key: 'handsOff', label: 'Hands-off', icon: Zap, active: handsOff, color: '#a855f7' },
    { key: 'listen', label: 'Listen', icon: Headphones, active: voiceEnabled, color: '#ec4899' },
    { key: 'vision', label: 'Vision', icon: Eye, active: localVision, color: '#22c55e' },
    { key: 'translate', label: 'Translate', icon: Languages, active: localTranslate, color: '#14b8a6' },
  ];
  const activeToolCount = toolItems.filter(t => t.active).length;
  const activeSkill = skills.find(s => s.id === activeSkillId);

  // Tappable follow-up suggestion chips → send the text like a normal message.
  const handleSuggestionClick = React.useCallback((text: string) => {
    if (!text.trim() || loading) return;
    sendText(text.trim());
  }, [sendText, loading]);

  React.useEffect(() => {
    if (!buildMode) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && !last.error) {
      const url = extractLocalhostUrl(last.content);
      if (url && url !== buildPreviewUrl) setBuildPreview(url);
    }
  }, [buildMode, messages, buildPreviewUrl, setBuildPreview]);

  // Refresh on-device sandbox readiness when entering Build Mode so the
  // "set up" nudge is accurate.
  React.useEffect(() => {
    if (buildMode && SandboxEnvService.isAvailable()) {
      SandboxEnvService.status().catch(() => {});
    }
  }, [buildMode]);

  const showEngine = useGiaStore((s) => s.showEngine);
  const setShowEngine = useGiaStore((s) => s.setShowEngine);
  const showModelSwitcher = useGiaStore((s) => s.showModelSwitcher);
  const [showToolsCatalog, setShowToolsCatalog] = React.useState(false);
  const setShowModelSwitcher = useGiaStore((s) => s.setShowModelSwitcher);
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);
  const [showPreviewSheet, setShowPreviewSheet] = React.useState(false);

  const { greeting, tip } = useProactiveMessage();

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
          {(() => {
            const filtered = sessions.filter(s => {
              if (s.title?.toLowerCase().includes(historySearch.toLowerCase())) return true;
              if (!historySearch) return false;
              return s.messages.some(m => m.message?.content?.toLowerCase().includes(historySearch.toLowerCase()));
            });
            return (
              <>
                {filtered.map((sess) => {
                  const matchCount = historySearch ? sess.messages.filter(m => m.message?.content?.toLowerCase().includes(historySearch.toLowerCase())).length : 0;
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
                {filtered.length === 0 && (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--gia-muted-2)' }}>No chats found{historySearch ? ` for "${historySearch}"` : ''}</p>
                )}
              </>
            );
          })()}

          {archivedSessions.length > 0 && (
            <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--gia-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide px-1 pb-2 flex items-center gap-1.5" style={{ color: 'var(--gia-muted-2)' }}>
                <Archive size={11} /> Archived ({archivedSessions.length})
              </p>
              {archivedSessions.filter(s => !historySearch || s.title?.toLowerCase().includes(historySearch.toLowerCase())).map((sess) => (
                <div key={sess.id} className="gia-card p-3 flex items-center gap-3" style={{ opacity: 0.85 }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--gia-text)' }}>{sess.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{sess.messages.length} msgs · {new Date(sess.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => restoreSession(sess.id)}
                    className="p-1.5 rounded-lg transition-colors text-zinc-600 hover:text-emerald-400"
                    title="Restore this archived chat"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--gia-bg)' }}>
      {/* Processing bar */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-30 overflow-hidden" style={{ background: 'rgba(168,85,247,0.15)' }}>
          <div className="h-full w-full" style={{
            background: 'linear-gradient(90deg, transparent, #a855f7, #8b5cf6, transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s linear infinite',
            width: '100%',
            height: '100%',
          }} />
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg transition-colors tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }}>
            <History size={15} />
          </button>
          <span className="text-xs font-medium truncate" style={{ color: 'var(--gia-muted)' }}>{activeSession?.title ?? 'New Chat'}</span>
          {activeSession && activeSession.branches && Object.keys(activeSession.branches).length > 0 && (
            <button onClick={() => setShowBranchView(true)} className="p-1 rounded-lg transition-colors tap-feedback shrink-0" style={{ color: '#a855f7' }} title="Branches">
              <GitBranch size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          {voiceEnabled && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0" style={{ background: 'rgba(236,72,153,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ec4899' }} />
              <span className="text-[8px] font-medium" style={{ color: '#ec4899' }}>LIVE</span>
            </div>
          )}
          <button
            onClick={() => setShowModelSwitcher(true)}
            className="gia-pill flex items-center gap-1.5 flex-1 min-w-0 max-w-[180px] tap-feedback transition-all"
            style={{
              background: providerConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: providerConnected ? '#34d399' : '#f87171',
              border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
            title="Switch model & provider"
          >
            <ProviderIcon provider={activeProvider} size={18} bare />
            <span className="truncate max-w-[70px]">{providerLabel}</span>
            {activeModel && providerConnected && (
              <span className="text-[7px] opacity-50 truncate max-w-[54px] hidden sm:inline">{activeModel.split('/').pop()}</span>
            )}
            <ChevronDown size={11} className="shrink-0 opacity-70" />
          </button>
          <button onClick={() => setShowFileManager(true)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} aria-label="File Manager" title="File Manager"><Upload size={13} /></button>
          <button onClick={() => setShowKnowledge(true)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} aria-label="Knowledge" title="Knowledge"><Brain size={13} /></button>
          <SearchActivityButton />
          <button onClick={exportChat} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} aria-label="Export chat" title="Export chat"><Download size={13} /></button>
          <button onClick={createSession} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} aria-label="New chat" title="New chat"><Plus size={13} /></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className="flex-1 overflow-y-auto pt-4 relative z-0" style={{ paddingBottom: `${inputContainerHeight + 120}px` }}>
        {messages.length === 0 && buildMode && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center pt-12 sm:pt-16 pb-24 sm:pb-40 animate-fade-in">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(234,88,12,0.1))', border: '1px solid rgba(249,115,22,0.3)', boxShadow: '0 0 40px rgba(249,115,22,0.25)' }}>
              <Hammer size={38} style={{ color: '#f97316' }} />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--gia-text)' }}>Build Mode</p>
              <p className="text-xs mt-1 max-w-[260px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>Describe the app you want to build. GIA scaffolds it, runs a dev server, and a Preview button appears when it's live — tap it to see your app.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-1">
              {[
                { label: 'To-do app', prompt: 'Build a simple to-do app with add, complete, and delete.' },
                { label: 'Quiz game', prompt: 'Build a quiz game with multiple-choice questions and a live score.' },
                { label: 'Landing page', prompt: 'Build a landing page for a fictional product with hero, features, and CTA.' },
              ].map((ex) => (
                <button key={ex.label} onClick={() => setInput(ex.prompt)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback" style={{ background: 'linear-gradient(135deg, #f973160a, #f9731603)', border: '1px solid #f9731640', backdropFilter: 'blur(8px)' }}>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f9731620', border: '1px solid #f9731630' }}><Hammer size={13} style={{ color: '#f97316' }} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{ex.label}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: '#f97316', opacity: 0.7 }}>{ex.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && !buildMode && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pt-12 sm:pt-16 pb-24 sm:pb-40 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1))', border: '1px solid rgba(168,85,247,0.2)' }}>
              <GiaIcon size={30} animate={false} color="#a855f7" />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--gia-text)' }}>{userProfile.name ? `Hey ${userProfile.name}` : greeting.emoji + ' ' + greeting.text}</p>
              <p className="text-xs mt-1 max-w-[240px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{providerConnected ? 'Your personal AI workspace. Ask anything, attach files, or pick a quick start below.' : 'No AI provider connected. Use the on-device local LLM or connect a provider in Settings.'}</p>
              {!messages.length && (
                <p className="text-[10px] mt-2 animate-fade-in" style={{ color: 'var(--gia-muted-2)' }}>
                  {tip.emoji} {tip.text}
                </p>
            )}
          </div>
            {!providerConnected && (
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-1">
              <button onClick={() => { useProviderStore.getState().setProviderKey('local-llm', ''); }} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-violet-900/30 border border-violet-500/20 hover:border-violet-400/40">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.2)' }}><Zap size={14} style={{ color: '#a855f7' }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Use Local AI (Free)</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>GIA works offline with on-device intelligence</p>
                </div>
              </button>
              <button onClick={() => setShowModelSwitcher(true)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(113,113,122,0.2)' }}><Bot size={14} style={{ color: '#a1a1aa' }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Connect AI Provider</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>OpenRouter, Anthropic, Gemini, or any API</p>
                </div>
              </button>
              {QUICK_STARTS.slice(0, 1).map((qs) => (
                <motion.button
                  key={qs.label}
                  onClick={() => setInput(qs.prompt)}
                  whileHover={{ scale: 1.02, borderColor: `${qs.color}60` }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback"
                  style={{ background: `linear-gradient(135deg, ${qs.color}08, ${qs.color}02)`, border: `1px solid ${qs.color}20`, backdropFilter: 'blur(8px)', boxShadow: `0 0 12px ${qs.color}08` }}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${qs.color}20`, border: `1px solid ${qs.color}30`, backdropFilter: 'blur(4px)' }}><qs.icon size={14} style={{ color: qs.color }} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{qs.label}</p>
                    <p className="text-[10px] truncate" style={{ color: qs.color }}>{qs.prompt}</p>
                  </div>
                </motion.button>
              ))}
            </div>
            )}
            {providerConnected && (
            <div className="grid grid-cols-1 gap-3 w-full max-w-xs mt-1 max-h-[52vh] overflow-y-auto pb-1 pr-0.5">
              {QUICK_STARTS.map((qs, i) => (
                  <motion.button
                    key={qs.label}
                    onClick={() => setInput(qs.prompt)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 200, damping: 20 }}
                    whileHover={{ scale: 1.02, borderColor: `${qs.color}60`, boxShadow: `0 0 20px ${qs.color}15` }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all shrink-0"
                    style={{ background: `linear-gradient(135deg, ${qs.color}0a, ${qs.color}03)`, border: `1px solid ${qs.color}20`, backdropFilter: 'blur(8px)', boxShadow: `0 4px 16px -4px ${qs.color}12` }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${qs.color}20`, border: `1px solid ${qs.color}30`, backdropFilter: 'blur(4px)' }}><qs.icon size={15} style={{ color: qs.color }} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{qs.label}</p>
                      <p className="text-[10px] truncate mt-0.5" style={{ color: qs.color, opacity: 0.7 }}>{qs.prompt}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="w-full sm:px-1.5 space-y-2 sm:space-y-3">
        {!providerConnected && !loading && (
          <div onClick={() => setShowModelSwitcher(true)} className="px-4 py-3 mx-4 rounded-2xl text-center cursor-pointer transition-opacity hover:opacity-80" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>⚡ No AI provider configured</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>Tap to connect a provider — OpenRouter, Anthropic, Gemini & more</p>
          </div>
        )}

        {activeSession && activeSession.currentBranchId && (
          <div className="mb-2">
            <SummaryBanner sessionId={activeSession.id} branchId={activeSession.currentBranchId} />
          </div>
        )}

        <AgentSwarmDashboard />

        <MessageList
          messages={messages}
          loading={loading}
          streamingMsgId={streamingMsgId}
          streamingMsgIds={streamingMsgIds}
          expandedMsgs={expandedMsgs}
          setExpandedMsgs={setExpandedMsgs}
          showThoughts={showThoughts}
          setShowThoughts={setShowThoughts}
          liveThoughts={liveThoughts}
          liveSegments={liveSegments}
          thinkingPhase={thinkingPhase}
          currentTool={currentTool}
          responseTimesRef={responseTimesRef}
          onCopyMessage={copyMessage}
          onEdit={handleEditResend}
          onDeleteWithUndo={handleDeleteWithUndo}
          onContinue={handleContinue}
          onFork={handleFork}
          onRetry={handleRetry}
          onEditResend={handleEditResend}
          onRewrite={handleRewrite}
          onSuggestionClick={handleSuggestionClick}
          clarification={clarification}
          onClarificationFormAnswer={handleClarificationAnswer}
        />

        {/* Inline tool execution cards — show recent tools inline in the chat flow */}
        <RecentToolExecutions loading={loading} />

        {/* Build mode — live preview rendered inline as part of the response */}
        {buildMode && buildPreviewUrl && !showPreviewSheet && (
          <BuildInlinePreview url={buildPreviewUrl} onOpenFull={() => setShowPreviewSheet(true)} />
        )}

        {clarification && !clarification.fields && (
          <ClarificationBottomSheet
            clarification={clarification}
            clarAnswer={clarAnswer}
            setClarAnswer={setClarAnswer}
            handleClarificationAnswer={handleClarificationAnswer}
            loading={loading}
            onDismiss={() => setClarification(null)}
          />
        )}
        {createPortal(<EngineSheet open={showEngine} onClose={() => setShowEngine(false)} />, document.body)}
        {createPortal(<ModelSwitcherSheet open={showModelSwitcher} onClose={() => setShowModelSwitcher(false)} onOpenEngine={() => setShowEngine(true)} />, document.body)}
        {createPortal(<ToolsCatalogSheet open={showToolsCatalog} onClose={() => setShowToolsCatalog(false)} />, document.body)}

        <AnimatePresence>
          {liveFileEdit && (
            <LiveFileEditor
              edit={liveFileEdit}
              onClose={() => setLiveFileEdit(null)}
            />
          )}
        </AnimatePresence>
        </div>
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(168,85,247,0.08)' }}>
            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl backdrop-blur-sm" style={{ background: 'rgba(26,26,36,0.9)', border: '2px dashed rgba(168,85,247,0.4)' }}>
              <Paperclip size={20} style={{ color: '#a855f7' }} />
              <p className="text-xs font-medium" style={{ color: '#a855f7' }}>Drop files here</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute right-4 bottom-32 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
            <ChevronDown size={14} style={{ color: 'var(--gia-muted)' }} />
          </motion.button>
        )}
      </AnimatePresence>

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

        <div ref={inputContainerRef} onPaste={handlePaste} className="px-3 pb-4 pt-2 absolute bottom-3 left-3 right-3 z-10 backdrop-blur-2xl rounded-2xl border shadow-2xl transition-all duration-300" style={{ background: messages.length === 0 ? 'rgba(10,10,15,0.7)' : 'rgba(10,10,15,0.2)', borderColor: messages.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.04)' }}>
        {showAgentMention && (
          <AgentMentionPicker
            query={agentMentionQuery}
            onSelect={handleAgentMentionSelect}
          />
        )}
        <input ref={fileRef} type="file" className="hidden" multiple onChange={e => handleFile(e)} accept=".txt,.md,.pdf,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log,.env" />
        <input ref={imgRef} type="file" className="hidden" multiple accept="image/*" onChange={e => handleFile(e, true)} />

        {processingFiles && (
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <Loader2 size={12} className="text-amber-400 animate-spin shrink-0" />
            <span className="text-[10px] text-zinc-400 truncate">
              Processing {processingFileName}...
            </span>
          </div>
        )}

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
          <button type="button"
            onClick={() => setShowTools(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors tap-feedback"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
            title="Tools"
          >
            <SlidersHorizontal size={14} />
          </button>

          <div className="flex-1 relative overflow-hidden">
            <div className="overflow-x-auto flex items-center gap-1.5 py-1 [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
              <Paperclip size={11} /> File
            </button>
            <button type="button" onClick={() => imgRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
              <ImageIcon size={11} /> Photo
            </button>
            <button type="button" onClick={async () => {
              try {
                const { Camera: CapCamera, CameraResultType } = await import('@capacitor/camera');
                const image = await CapCamera.getPhoto({ resultType: CameraResultType.DataUrl, quality: 85, allowEditing: false, saveToGallery: false });
                if (image.dataUrl) {
                  const blob = await (await fetch(image.dataUrl)).blob();
                  const file = new File([blob], `camera-${Date.now()}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });
                  await addFiles([file], true);
                }
              } catch (e) {
                if (e instanceof Error && e.message !== 'User cancelled photos app') {
                  imgRef.current?.click();
                }
              }
            }} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
              <Camera size={11} /> Camera
            </button>
            <button type="button" onClick={() => setShowTemplateSelector(true)} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-purple-400 hover:text-purple-300 transition-all shrink-0">
              <LayoutTemplate size={11} /> Templates
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />
            <button type="button" onClick={() => {
              if (forceBuild) return;
              const next = !buildModeStore;
              setBuildMode(next);
              useGiaStore.getState().updateSharedData({ currentMode: next ? 'build' : 'code' });
            }} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback shrink-0" style={{ background: buildMode ? '#f9731620' : 'var(--gia-surface)', border: `1px solid ${buildMode ? '#f9731640' : 'var(--gia-border)'}`, color: buildMode ? '#f97316' : 'var(--gia-muted)', fontWeight: 500 }}>
              <Hammer size={11} />
              Build
            </button>
            {buildMode && (
              <button type="button" onClick={() => setShowPreviewSheet(true)} disabled={!buildPreviewUrl} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: buildPreviewUrl ? '#22c55e15' : 'var(--gia-surface)', border: `1px solid ${buildPreviewUrl ? '#22c55e40' : 'var(--gia-border)'}`, color: buildPreviewUrl ? '#22c55e' : 'var(--gia-muted)', fontWeight: 500 }}>
                {buildPreviewUrl && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />}
                <Eye size={11} />
                Preview
              </button>
            )}
          </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none" style={{ background: 'linear-gradient(to right, transparent, var(--gia-bg))' }} />
          </div>
          {buildMode && sandboxEnvReady === false && (
            <button type="button" onClick={() => useGiaStore.getState().setModule('settings')} className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg self-start transition-colors tap-feedback" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
              <Terminal size={11} />
              Set up sandbox to preview apps
            </button>
          )}
          {activeToolCount > 0 && (
            <span className="text-[10px] shrink-0 px-2 py-1 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>
              {activeToolCount} active
            </span>
          )}
          {activeSkill && (
            <button
              onClick={() => setShowSkillPicker(true)}
              title={`Active skill: ${activeSkill.name}`}
              className="flex items-center gap-1 text-[10px] shrink-0 px-2 py-1 rounded-full tap-feedback transition-all"
              style={{ background: 'rgba(168,85,247,0.12)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              <Sparkles size={10} />
              <span className="font-semibold max-w-[80px] truncate">{activeSkill.name}</span>
            </button>
          )}
          <ComposerToolsSheet
            open={showTools}
            onClose={() => setShowTools(false)}
            items={toolItems}
            onToggle={(key) => toggleFeature(key as 'webSearch' | 'deepSearch' | 'extThinking' | 'handsOff' | 'listen' | 'vision' | 'translate')}
            footer={
              <>
                {activeSkill && (
                  <button
                    onClick={() => { setShowTools(false); setShowSkillPicker(true); }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left text-[13px] tap-feedback transition-colors active:bg-white/5"
                    style={{ color: 'var(--gia-text)' }}
                  >
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>
                      <Sparkles size={15} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block">Skill: <span className="font-semibold">{activeSkill.name}</span></span>
                      <span className="block text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Tap to switch skills</span>
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--gia-muted-2)' }} />
                  </button>
                )}
                <button
                  onClick={() => { setShowTools(false); setShowToolsCatalog(true); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left text-[13px] tap-feedback transition-colors active:bg-white/5"
                  style={{ color: 'var(--gia-text)' }}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>
                    <Wrench size={15} />
                  </span>
                  <span className="flex-1">All Tools</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>{giaTools.getAllTools().length}</span>
                  <ChevronRight size={14} style={{ color: 'var(--gia-muted-2)' }} />
                </button>
                <button
                  onClick={() => { setShowTools(false); useGiaStore.getState().setModule('settings'); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left text-[13px] tap-feedback transition-colors active:bg-white/5"
                  style={{ color: 'var(--gia-text)' }}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--gia-muted)' }}>
                    <SettingsIcon size={15} />
                  </span>
                  <span className="flex-1">Settings</span>
                  <ChevronRight size={14} style={{ color: 'var(--gia-muted-2)' }} />
                </button>
              </>
            }
          />
        </div>

        <AmbientInput value={input} onChange={handleInputChange} onSubmit={handleSend} onStop={loading ? handleStop : undefined} isLoading={loading} onVoiceToggle={() => toggleFeature('listen')} isVoiceListening={voiceEnabled} placeholder={buildMode ? 'Describe what to build…' : webSearch ? 'Ask anything — I\'ll search the web…' : handsOff ? 'GIA has control — ask and it acts…' : 'Message GIA…'} prefix={buildMode ? <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium shrink-0 mr-1"><Hammer size={10} />Build</span> : undefined} />
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
              addNotification(`Skill active: ${skills.find((s: { id: string; name: string }) => s.id === skillId)?.name}`);
            }}
            onClose={() => setShowSkillPicker(false)}
          />
        )}
      </AnimatePresence>
      <BuildPreviewSheet url={buildPreviewUrl} open={showPreviewSheet} onClose={() => setShowPreviewSheet(false)} />
      {showKnowledge && <KnowledgePanel onClose={() => setShowKnowledge(false)} />}
      {showFileManager && <FileManager onClose={() => setShowFileManager(false)} />}
      {showBranchView && activeSession && (
        <BranchView
          session={activeSession}
          messages={messages}
          onClose={() => setShowBranchView(false)}
        />
      )}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
      />
    </div>
  );
};

export default ChatModule;

const SearchActivityButton: React.FC = () => {
  const { queryCount, sources, panelOpen, setPanelOpen } = useSearchActivity();
  const total = queryCount + sources.length;
  if (total === 0) return null;
  return (
    <button
      onClick={() => setPanelOpen(!panelOpen)}
      className="p-1.5 rounded-lg tap-feedback shrink-0 relative"
      style={{ color: panelOpen ? '#a855f7' : 'var(--gia-muted)' }}
      title={`Search Activity (${total})`}
    >
      <Globe size={13} />
      <span
        className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full"
        style={{ background: '#a855f7' }}
      />
    </button>
  );
};

const BuildInlinePreview: React.FC<{ url: string; onOpenFull: () => void }> = ({ url, onOpenFull }) => {
  const [refreshKey, setRefreshKey] = React.useState(0);
  return (
    <div className="mx-1 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(249,115,22,0.3)', background: '#0a0a0a', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(249,115,22,0.2)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: '#f97316' }}>Live preview</span>
        <span className="text-[10px] truncate flex-1 min-w-0" style={{ color: 'var(--gia-muted)' }}>{url}</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15 shrink-0"
          style={{ color: 'var(--gia-muted-2)' }}
          aria-label="Refresh preview"
          title="Refresh preview"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={onOpenFull}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15 shrink-0"
          style={{ color: '#f97316' }}
          aria-label="Open full preview"
          title="Open full preview"
        >
          <Maximize2 size={12} />
        </button>
      </div>
      <iframe
        key={refreshKey}
        src={url}
        title="GIA build preview"
        className="w-full"
        style={{ height: 240, border: 'none', background: '#fff', display: 'block' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-pointer-lock"
      />
    </div>
  );
};

const RecentToolExecutions: React.FC<{ loading: boolean }> = ({ loading }) => {
  const consoleProtocols = useProtocolStore(s => s.consoleProtocols);

  if (consoleProtocols.length === 0) return null;

  const active = consoleProtocols.filter(p => p.state === 'executing' || p.state === 'proposed');
  const done = consoleProtocols.filter(p => p.state === 'completed' || p.state === 'failed' || p.state === 'rejected').slice(-6);

  if (done.length === 0 && active.length === 0) return null;

  const activeTray = loading && active.length > 0 ? <ToolTray protocols={active} /> : null;
  const doneTray = !loading && done.length > 0 ? <ToolTray protocols={done} /> : null;

  if (!activeTray && !doneTray) return null;

  return (
    <div className="space-y-2 px-1">
      {activeTray}
      {doneTray}
    </div>
  );
};
