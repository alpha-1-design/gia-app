import React from 'react';
import {
  Bot, Plus, History, Trash2,
  Paperclip, X, Download, Globe, Image as ImageIcon, Camera,
  Brain, ChevronDown, ChevronRight, Sparkles, GraduationCap, Code2,
  BookOpen, Zap, Undo2, Search, Headphones, Folder, GitBranch,
  Eye, CheckCircle2, Loader2, Upload, LayoutTemplate, Languages,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGiaStore } from '../store/useGiaStore';
import { useProtocolStore } from '../store/useProtocolStore';
import { useSearchActivity } from '../store/useSearchActivity';
import { useChatState } from '../hooks/useChatState';
import { useProactiveMessage } from '../hooks/useProactiveMessage';
import GiaIcon from '../components/GiaIcon';
import MessageList from '../components/MessageList';
import AmbientInput from '../components/AmbientInput';
import SkillPicker from '../components/SkillPicker';
import GiaConsole from '../components/GiaConsole';
import { KnowledgePanel } from '../components/KnowledgePanel';
import FileBrowser from '../components/FileBrowser';
import FileManager from '../components/FileManager';
import InlineToolExecution from '../components/InlineToolExecution';
import { ClarificationBottomSheet } from '../components/chat/ClarificationBottomSheet';
import { EngineSheet } from '../components/chat/EngineSheet';
import { BranchView } from '../components/chat/BranchView';
import { SummaryBanner } from '../components/chat/SummaryBanner';
import AgentMentionPicker from '../components/AgentMentionPicker';
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

const ChatModule: React.FC = () => {
  const {
    input, setInput, loading, streamingMsgId, streamingMsgIds, voiceEnabled,
    showHistory, setShowHistory, historySearch, setHistorySearch, attachments,
    processingFiles, processingFileName,
    showScrollBtn, undoMsg, showSkillPicker,
    expandedMsgs, setExpandedMsgs, showThoughts, setShowThoughts,
    liveThoughts, showKnowledge, setShowKnowledge,
    isDragging, showFileBrowser, setShowFileBrowser, showFileManager, setShowFileManager, showTools,
    inputContainerHeight,
    scrollRef, inputContainerRef, fileRef, imgRef,
    responseTimesRef, clarAnswer, setClarAnswer,
    activeSessionId, setActiveSession, sessions,
    createSession, deleteSession, clearSession,
    addNotification,
    webSearch, extThinking, handsOff,
    localVision, localTranslate,
    activeSkillId, setSkill,
    skills, thinkingPhase, currentTool, showConsole, consoleLogs,
    messages, activeSession, providerConnected, providerLabel,
    activeModel,
    toggleFeature, handleStop, handleUndoDelete,
    handleInputChange, handleSend, handleClarificationAnswer,
    handleDeleteWithUndo, handleContinue, handleFork, handleRetry, handleEditResend,
    handlePaste, handleDragEnter, handleDragLeave,
    handleDragOver, handleDrop, handleFile, removeAttachment, addFiles,
    copyMessage, scrollToBottom, handleScroll, exportChat,
    setShowSkillPicker, setShowTools, setShowConsole,
    showBranchView, setShowBranchView,
    clarification, setClarification,
    showAgentMention, agentMentionQuery, handleAgentMentionSelect,
    liveFileEdit, setLiveFileEdit,
  } = useChatState();

  const [showEngine, setShowEngine] = React.useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);

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
          {sessions.filter(s => {
            if (s.title?.toLowerCase().includes(historySearch.toLowerCase())) return true;
            if (!historySearch) return false;
            return s.messages.some(m => m.message?.content?.toLowerCase().includes(historySearch.toLowerCase()));
          }).map((sess) => {
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
          {sessions.filter(s => {
            if (s.title?.toLowerCase().includes(historySearch.toLowerCase())) return true;
            if (!historySearch) return false;
            return s.messages.some(m => m.message?.content?.toLowerCase().includes(historySearch.toLowerCase()));
          }).length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--gia-muted-2)' }}>No chats found{historySearch ? ` for "${historySearch}"` : ''}</p>
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
          <div className="gia-pill flex items-center gap-1.5 flex-1 min-w-0 max-w-[180px]" style={{
            background: providerConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: providerConnected ? '#34d399' : '#f87171',
            border: `1px solid ${providerConnected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: providerConnected ? '#34d399' : '#f87171' }} />
            <span className="truncate max-w-[80px]">{providerLabel}</span>
            {activeModel && providerConnected && (
              <span className="text-[7px] opacity-50 truncate max-w-[60px] hidden sm:inline">{activeModel.split('/').pop()}</span>
            )}
          </div>
          <button onClick={() => setShowFileBrowser(true)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} title="Browse files"><Folder size={13} /></button>
          <button onClick={() => setShowFileManager(true)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }} title="File Manager"><Upload size={13} /></button>
          <button onClick={() => setShowKnowledge(true)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }}><Brain size={13} /></button>
          <SearchActivityButton />
          <button onClick={exportChat} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }}><Download size={13} /></button>
          <button onClick={() => activeSessionId && clearSession(activeSessionId)} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }}><Trash2 size={13} /></button>
          <button onClick={createSession} className="p-1.5 rounded-lg tap-feedback shrink-0" style={{ color: 'var(--gia-muted)' }}><Plus size={13} /></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className="flex-1 overflow-y-auto pt-4 relative z-0" style={{ paddingBottom: `${inputContainerHeight + 120}px` }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pt-12 sm:pt-16 pb-24 sm:pb-40 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1))', border: '1px solid rgba(168,85,247,0.2)' }}>
              <GiaIcon size={30} animate={false} color="#a855f7" />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--gia-text)' }}>{useGiaStore.getState().userProfile.name ? `Hey ${useGiaStore.getState().userProfile.name}` : greeting.emoji + ' ' + greeting.text}</p>
              <p className="text-xs mt-1 max-w-[240px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{providerConnected ? 'Your personal AI workspace. Ask anything, attach files, or pick a quick start below.' : 'No AI provider connected. Use the on-device local LLM or connect a provider in Settings.'}</p>
              {!messages.length && (
                <p className="text-[10px] mt-2 animate-fade-in" style={{ color: 'var(--gia-muted-2)' }}>
                  {tip.emoji} {tip.text}
                </p>
              )}
            </div>
            {!providerConnected && (
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-1">
              <button onClick={() => { setInput('Start with your local AI model. '); }} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-violet-900/30 border border-violet-500/20 hover:border-violet-400/40">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.2)' }}><Zap size={14} style={{ color: '#a855f7' }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Use Local AI (Free)</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>GIA works offline with on-device intelligence</p>
                </div>
              </button>
              <button onClick={() => useGiaStore.getState().setModule('settings')} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50">
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

        <div className="max-w-3xl mx-auto w-full px-4 space-y-2 sm:space-y-3">
        {!providerConnected && !loading && (
          <div onClick={() => useGiaStore.getState().setModule('settings')} className="px-4 py-3 mx-4 rounded-2xl text-center cursor-pointer transition-opacity hover:opacity-80" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>⚡ No AI provider configured</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>Tap to go to Settings → Engine Room and type: <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>connect</code></p>
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
        />

        {/* Inline tool execution cards — show recent tools inline in the chat flow */}
        <RecentToolExecutions loading={loading} />

        {clarification && (
          <ClarificationBottomSheet
            clarification={clarification}
            clarAnswer={clarAnswer}
            setClarAnswer={setClarAnswer}
            handleClarificationAnswer={handleClarificationAnswer}
            loading={loading}
            onDismiss={() => setClarification(null)}
          />
        )}
        <EngineSheet open={showEngine} onClose={() => setShowEngine(false)} />

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
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToBottom} className="absolute right-4 bottom-32 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 bg-zinc-800 border border-zinc-700">
            <ChevronDown size={14} className="text-zinc-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Stop button — floats above input when loading */}
      {loading && handleStop && (
        <div className="absolute bottom-[72px] right-6 z-10">
          <button onClick={handleStop} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Stop" style={{ color: 'var(--gia-muted-2)' }}>
            <svg width="10" height="10" viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill="currentColor" /></svg>
          </button>
        </div>
      )}

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
                className="flex items-center gap-1.5 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden"
                >
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
                {[
                  { label: 'Search', feature: 'webSearch' as const, icon: Globe, active: webSearch, color: '#3b82f6' },
                  { label: 'Think', feature: 'extThinking' as const, icon: Brain, active: extThinking, color: '#f59e0b' },
                  { label: 'Hands-off', feature: 'handsOff' as const, icon: Zap, active: handsOff, color: '#a855f7' },
                  { label: 'Listen', feature: 'listen' as const, icon: Headphones, active: voiceEnabled, color: '#ec4899' },
                  { label: 'Vision', feature: 'vision' as const, icon: Eye, active: localVision, color: '#22c55e' },
                  { label: 'Translate', feature: 'translate' as const, icon: Languages, active: localTranslate, color: '#14b8a6' },
                ].map((tool: { label: string; feature: string; icon: React.ComponentType<{ size?: number }>; active: boolean; color: string; action?: boolean }) => (
                  <button type="button" key={tool.label} onClick={() => tool.action ? useGiaStore.getState().setShowCircleSearch(true) : toggleFeature(tool.feature as 'webSearch' | 'extThinking' | 'handsOff' | 'listen' | 'vision')} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback shrink-0" style={{ background: tool.active ? `${tool.color}20` : 'var(--gia-surface)', border: `1px solid ${tool.active ? `${tool.color}40` : 'var(--gia-border)'}`, color: tool.active ? tool.color : 'var(--gia-muted)', fontWeight: 500 }}>
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
                    {localVision && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-emerald-500/20 text-emerald-400"><Eye size={10} /></div>}
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                    {(!webSearch && !extThinking && !handsOff && !localVision && !voiceEnabled) ? 'No active tools' : 'Tools active'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

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
              addNotification(`Skill active: ${skills.find((s: { id: string; name: string }) => s.id === skillId)?.name}`);
            }}
            onClose={() => setShowSkillPicker(false)}
          />
        )}
      </AnimatePresence>
      {showKnowledge && <KnowledgePanel onClose={() => setShowKnowledge(false)} />}
      {showFileBrowser && <FileBrowser onClose={() => setShowFileBrowser(false)} />}
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
      <GiaConsole
        logs={consoleLogs}
        isVisible={showConsole}
        onClose={() => setShowConsole(false)}
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
      title="Search Activity"
    >
      <Globe size={13} />
      <span
        className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white"
        style={{ background: '#a855f7' }}
      >
        {total > 9 ? '9+' : total}
      </span>
    </button>
  );
};

const RecentToolExecutions: React.FC<{ loading: boolean }> = ({ loading }) => {
  const consoleProtocols = useProtocolStore(s => s.consoleProtocols);

  if (consoleProtocols.length === 0) return null;

  const active = consoleProtocols.filter(p => p.state === 'executing' || p.state === 'proposed');
  const done = consoleProtocols.filter(p => p.state === 'completed' || p.state === 'failed' || p.state === 'rejected').slice(-6);

  if (done.length === 0 && active.length === 0) return null;

  return (
    <div className="space-y-0.5 px-1">
      {loading && active.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#a855f7' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: '#a855f7' }}>Executing tools</span>
          </div>
          {active.map((p, i) => <InlineToolExecution key={p.id} protocol={p} index={i} />)}
        </div>
      )}
      {!loading && done.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <CheckCircle2 size={9} style={{ color: '#22c55e' }} />
            </motion.div>
            <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: '#22c55e' }}>Actions completed</span>
          </div>
          {done.map((p, i) => <InlineToolExecution key={p.id} protocol={p} index={i} />)}
        </div>
      )}
    </div>
  );
};
