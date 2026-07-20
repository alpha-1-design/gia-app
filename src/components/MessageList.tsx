import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, AlertCircle, RotateCcw, Paperclip, Brain, ChevronDown, ChevronRight, Lock, Cloud, Globe, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ThinkingPanel } from './ThinkingPanel';
import { WorkLog } from './WorkLog';
import TaskProgress from './TaskProgress';
import GiaIcon from './GiaIcon';
import OrbAvatar from './OrbAvatar';
import { useGiaStore } from '../store/useGiaStore';
import MarkdownRenderer from './MarkdownRenderer';
import ArtifactsPanel from './ArtifactsPanel';
import MessageActionSheet from './MessageActionSheet';
import { ChatSkeleton } from './feedback';
import { resolveAgentColor, resolveAgentIcon } from '../utils/agentIcons';
import ToolTray from './ToolTray';
import { useProtocolStore } from '../store/useProtocolStore';
import type { Message, ThinkingPhase } from '../store/useGiaStore';

const AgentBadge: React.FC<{ agentName?: string; agentIcon?: string; agentTask?: string }> = ({ agentName, agentIcon, agentTask }) => {
  const color = resolveAgentColor(agentIcon || 'Bot');
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-semibold uppercase tracking-wider" style={{ background: `${color}15`, color }}>
      <OrbAvatar color={color} size={10} animate={false} glow={false} />
      {agentName || 'Agent'}
      {agentTask && (
        <span className="ml-0.5 text-[7px] opacity-60 font-normal normal-case max-w-[120px] truncate">{agentTask}</span>
      )}
    </span>
  );
};

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  streamingMsgId: string | null;
  streamingMsgIds?: Set<string>;
  expandedMsgs: Set<string>;
  setExpandedMsgs: React.Dispatch<React.SetStateAction<Set<string>>>;
  showThoughts: Set<string>;
  setShowThoughts: React.Dispatch<React.SetStateAction<Set<string>>>;
  liveThoughts: Record<string, string>;
  thinkingPhase: ThinkingPhase;
  currentTool: string | null;
  responseTimesRef: React.MutableRefObject<Record<string, number>>;
  onCopyMessage: (id: string, content: string) => void;
  onEdit: (id: string) => void;
  onDeleteWithUndo: (id: string) => void;
  onContinue: (id: string) => void;
  onFork: (id: string) => void;
  onRetry: (id: string) => Promise<void>;
  onEditResend: (msgId: string) => void;
  onRewrite: (id: string, instruction: string) => void;
}

const formatTimeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const LONG_MSG_CHARS = 3000;

const SourcesBlock: React.FC<{ sources: Array<string | { url: string; title?: string }> }> = ({ sources }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] font-semibold tap-feedback transition-colors hover:opacity-80"
        style={{ color: 'var(--gia-muted-2)' }}
      >
        <Globe size={11} />
        <span>Searched {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1.5">
          {sources.map((src, si) => {
            const url = typeof src === 'string' ? src : (src as { url: string; title?: string }).url || '';
            const title = typeof src === 'string' ? url : (src as { url: string; title?: string }).title || `Source ${si + 1}`;
            const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();
            return (
              <motion.a
                key={si}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.8, delay: si * 0.08 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}
              >
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold shrink-0"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
                  {si + 1}
                </span>
                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" className="w-3.5 h-3.5 rounded shrink-0" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium" style={{ color: 'var(--gia-text)' }}>{title}</span>
                  <span className="block text-[7px] truncate" style={{ color: '#64748b' }}>{domain}</span>
                </div>
              </motion.a>
            );
          })}
        </div>
      )}
    </div>
  );
};

function useShowTokenUsage(): boolean {
  const [show, setShow] = useState(() => localStorage.getItem('gia-show-token-usage') === 'true');
  useEffect(() => {
    const handler = () => setShow(localStorage.getItem('gia-show-token-usage') === 'true');
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return show;
}

const MessageList: React.FC<MessageListProps> = ({
  messages, loading, streamingMsgId, streamingMsgIds,
  expandedMsgs, setExpandedMsgs,
  showThoughts, setShowThoughts,
  liveThoughts, thinkingPhase, currentTool,
  responseTimesRef,
  onCopyMessage, onEdit, onDeleteWithUndo, onContinue,
  onFork, onRetry, onEditResend, onRewrite,
}) => {
  const extThinking = useGiaStore(s => s.extThinking);
  const showTokenUsage = useShowTokenUsage();
  const [sheetMsgId, setSheetMsgId] = useState<string | null>(null);
  const reactions = useGiaStore(s => s.reactions);
  const consoleProtocols = useProtocolStore(s => s.consoleProtocols);
  return (
    <>
      {loading && messages.length === 0 && (
        <ChatSkeleton count={3} />
      )}
      {messages.map((msg) => (
        <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-2 sm:gap-3 md:gap-3.5 group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5" style={msg.agentId ? { background: `${resolveAgentColor(msg.agentIcon || 'Bot')}20`, border: `1px solid ${resolveAgentColor(msg.agentIcon || 'Bot')}40` } : { background: msg.role === 'user' ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : msg.error ? 'rgba(239,68,68,0.15)' : 'var(--gia-surface-2)', border: msg.role === 'assistant' ? '1px solid var(--gia-border)' : 'none' }}>
            {msg.agentId ? <OrbAvatar color={resolveAgentColor(msg.agentIcon || 'Bot')} size={18} animate={false} icon={React.createElement(resolveAgentIcon(msg.agentIcon || 'Bot'))} /> : msg.role === 'user' ? <User size={13} className="text-white" /> : msg.error ? <AlertCircle size={13} style={{ color: '#f87171' }} /> : msg.thinking ? extThinking ? <GiaIcon size={13} animate color="#a855f7" /> : <div className="flex gap-0.5">{[0,1,2].map(d => <div key={d} className="thinking-dot" style={{ animationDelay: `${d * 0.16}s` }} />)}</div> : <GiaIcon size={14} animate={false} color="var(--gia-muted)" />}
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
              <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: msg.agentId ? resolveAgentColor(msg.agentIcon || 'Bot') : msg.role === 'user' ? '#a855f7' : 'var(--gia-muted-2)' }}>
                {msg.agentId ? msg.agentName : msg.role === 'user' ? 'You' : 'GIA'}
              </span>
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }} title={new Date(msg.timestamp).toLocaleString()}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <>
              <div
                className={`p-3 sm:p-4 md:p-5 rounded-2xl relative cursor-pointer ${msg.role === 'user' ? 'bg-violet-600/10 border border-violet-500/20' : msg.error ? 'bg-rose-950/20 border border-rose-800/30' : streamingMsgId === msg.id || streamingMsgIds?.has(msg.id) ? 'streaming-message' : ''}`}
                style={{
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '20px',
                  borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '20px',
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, button')) return;
                  setSheetMsgId(prev => (prev === msg.id ? null : msg.id));
                }}
              >
                {msg.thinking && !((streamingMsgId === msg.id || streamingMsgIds?.has(msg.id)) && msg.content) ? (
                  <div>
                    <WorkLog
                      thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                      isLive={!!liveThoughts[msg.id]}
                      isExpanded={showThoughts.has(msg.id) || !!liveThoughts[msg.id]}
                      onToggle={() => setShowThoughts(prev => {
                        const n = new Set(prev);
                        if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                        return n;
                      })}
                      currentTool={currentTool}
                      thinkingPhase={thinkingPhase}
                      startTime={msg.timestamp}
                    />
                  </div>
                ) : msg.error ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm leading-relaxed" style={{ color: '#f87171' }}>{msg.content}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onRetry(msg.id)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-semibold w-fit" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                        <RotateCcw size={10} /> Retry
                      </button>
                      <button onClick={() => onEditResend(msg.id)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] w-fit" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                        <RotateCcw size={10} /> Edit & Resend
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1.5 ml-0.5">
                        {msg.agentId ? (
                          <AgentBadge agentName={msg.agentName} agentIcon={msg.agentIcon} agentTask={msg.agentTask} />
                        ) : (
                          <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
                            {msg.model ? `via ${msg.model}` : 'GIA'}
                          </span>
                        )}
                        <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }} title={new Date(msg.timestamp).toLocaleString()}>
                          {formatTimeAgo(msg.timestamp)}
                        </span>
                        {msg.thinking ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>
                            Thinking…
                          </span>
                        ) : streamingMsgId === msg.id || streamingMsgIds?.has(msg.id) ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            Generating…
                          </span>
                        ) : responseTimesRef.current[msg.id] ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                            {(responseTimesRef.current[msg.id] / 1000).toFixed(1)}s
                          </span>
                        ) : null}
                        {showTokenUsage && msg.tokenUsage && !msg.thinking && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                            {msg.tokenUsage.total} tok
                          </span>
                        )}
                      </div>
                    )}
                    {msg.thinking && (streamingMsgId === msg.id || streamingMsgIds?.has(msg.id)) && msg.content && (
                      <div className="mb-2">
                        <WorkLog
                          thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                          isLive={!!liveThoughts[msg.id]}
                          isExpanded={showThoughts.has(msg.id)}
                          onToggle={() => setShowThoughts(prev => {
                            const n = new Set(prev);
                            if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                            return n;
                          })}
                          currentTool={currentTool}
                          thinkingPhase={thinkingPhase}
                          startTime={msg.timestamp}
                        />
                      </div>
                    )}
                    {msg.content.length > LONG_MSG_CHARS && !expandedMsgs.has(msg.id) ? (
                      <>
                        <MarkdownRenderer content={msg.content.slice(0, LONG_MSG_CHARS)} sources={msg.sources} />
                        <button onClick={() => setExpandedMsgs(prev => new Set(prev).add(msg.id))} className="mt-2 text-[11px] font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                          Show more ({Math.ceil((msg.content.length - LONG_MSG_CHARS) / 1000)}k+ chars)
                        </button>
                      </>
                    ) : (
                      <div className="token-reveal">
                        <MarkdownRenderer content={msg.content} sources={msg.sources} />
                        {(streamingMsgId === msg.id || streamingMsgIds?.has(msg.id)) && msg.content && loading && (
                          extThinking
                            ? <GiaIcon size={13} animate color="#a855f7" className="ml-1" speed={1.3} />
                            : <span className="stream-cursor ml-0.5">▋</span>
                        )}
                        {expandedMsgs.has(msg.id) && (
                          <button onClick={() => setExpandedMsgs(prev => { const n = new Set(prev); n.delete(msg.id); return n; })} className="mt-2 text-[11px] font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
                            Show less
                          </button>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' && !msg.thinking && !msg.error && (
                      <div className="mt-1.5 text-[9px] text-right tracking-wider select-none flex items-center justify-end gap-1.5" style={{ color: 'var(--gia-muted-3)' }}>
                        <span className="opacity-40">— </span>
                        <span style={{ color: msg.agentId ? `${resolveAgentColor(msg.agentIcon || 'Bot')}66` : '#a855f766' }}>✦</span>
                        <span className="font-medium ml-0.5" style={{ color: msg.agentId ? `${resolveAgentColor(msg.agentIcon || 'Bot')}44` : '#a855f744' }}>{msg.agentId ? msg.agentName : 'GIA'}</span>
                        {msg.source === 'on-device' && (
                          <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            <Lock size={9} /> on-device
                          </span>
                        )}
                        {msg.source === 'cloud' && (
                          <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                            <Cloud size={9} /> cloud
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' && reactions[msg.id] && (
                      <div className="mt-1 flex items-center gap-1" style={{ color: reactions[msg.id] === 'up' ? '#22c55e' : '#f87171' }}>
                        {reactions[msg.id] === 'up' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                        <span className="text-[9px] tracking-wider select-none">{reactions[msg.id] === 'up' ? 'Liked' : 'Disliked'}</span>
                      </div>
                    )}
                    {msg.artifacts && msg.artifacts.length > 0 && (
                      <ArtifactsPanel artifacts={msg.artifacts} />
                    )}
                    {msg.role === 'assistant' && consoleProtocols.filter(p => p.messageId === msg.id).length > 0 && (
                      <ToolTray
                        protocols={consoleProtocols
                          .filter(p => p.messageId === msg.id)
                          .sort((a, b) => a.createdAt - b.createdAt)}
                      />
                    )}
                    {(liveThoughts[msg.id] || msg.thoughts) && (
                      <div className="rounded-xl overflow-hidden transition-all duration-300" style={{
                        border: '1px solid rgba(251,191,36,0.12)',
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(217,119,6,0.02))',
                      }}>
                        <button
                          onClick={() => setShowThoughts(prev => {
                            const n = new Set(prev);
                            if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                            return n;
                          })}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                          style={{ color: '#f59e0b' }}
                        >
                          <Brain size={12} />
                          <span className="text-[11px] font-medium flex-1">
                            {showThoughts.has(msg.id) ? 'Hide' : 'Show'} reasoning ({(msg.thoughts || '').split(' ').length} words)
                          </span>
                          {showThoughts.has(msg.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                        <ThinkingPanel
                          thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                          isLive={!!liveThoughts[msg.id]}
                          isExpanded={showThoughts.has(msg.id)}
                          onToggle={() => setShowThoughts(prev => {
                            const n = new Set(prev);
                            if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                            return n;
                          })}
                        />
                      </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourcesBlock sources={msg.sources} />
                    )}
                    {msg.attachments?.filter(a => !a.preview).map(att => (
                      <div key={att.name} className="mt-2 flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg" style={{ background: 'var(--gia-surface-2)' }}>
                        <Paperclip size={10} /> {att.name}
                      </div>
                    ))}
                  </>
                )}
                {msg.tasks && msg.tasks.length > 0 && (
                  <TaskProgress tasks={msg.tasks} agentColor={msg.agentId ? resolveAgentColor(msg.agentIcon || 'Bot') : undefined} />
                )}
              </div>
            </>
          </div>
        </motion.div>
      ))}
      <MessageActionSheet
        msg={sheetMsgId ? (messages.find(m => m.id === sheetMsgId) ?? null) : null}
        onClose={() => setSheetMsgId(null)}
        onCopy={onCopyMessage}
        onRetry={onRetry}
        onEdit={onEdit}
        onContinue={onContinue}
        onFork={onFork}
        onDelete={onDeleteWithUndo}
        onRewrite={onRewrite}
        reaction={sheetMsgId ? reactions[sheetMsgId] : undefined}
        onReact={(value) => { if (sheetMsgId) useGiaStore.getState().setReaction(sheetMsgId, value); }}
        nextAssistantId={sheetMsgId ? (() => {
          const i = messages.findIndex(m => m.id === sheetMsgId);
          const n = messages[i + 1];
          return n && n.role === 'assistant' ? n.id : undefined;
        })() : undefined}
      />
    </>
  );
};

export default MessageList;
