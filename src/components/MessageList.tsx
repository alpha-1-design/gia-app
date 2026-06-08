import React from 'react';
import { motion } from 'motion/react';
import { Bot, User, AlertCircle, RotateCcw, Paperclip } from 'lucide-react';
import { ThinkingPanel } from './ThinkingPanel';
import { ThinkingStatus } from './ThinkingStatus';
import MarkdownRenderer from './MarkdownRenderer';
import MessageContextMenu from './MessageContextMenu';
import type { Message, ThinkingPhase } from '../store/useGiaStore';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  streamingMsgId: string | null;
  expandedMsgs: Set<string>;
  setExpandedMsgs: React.Dispatch<React.SetStateAction<Set<string>>>;
  showThoughts: Set<string>;
  setShowThoughts: React.Dispatch<React.SetStateAction<Set<string>>>;
  liveThoughts: Record<string, string>;
  thinkingPhase: ThinkingPhase;
  responseTimesRef: React.MutableRefObject<Record<string, number>>;
  onCopyMessage: (id: string, content: string) => void;
  onEdit: (id: string) => void;
  onDeleteWithUndo: (id: string) => void;
  onContinue: (id: string) => void;
  onFork: (id: string) => void;
  onRetry: (id: string) => Promise<void>;
  onEditResend: (msgId: string) => void;
}

const formatTimeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const LONG_MSG_CHARS = 3000;

const MessageList: React.FC<MessageListProps> = ({
  messages, loading, streamingMsgId,
  expandedMsgs, setExpandedMsgs,
  showThoughts, setShowThoughts,
  liveThoughts, thinkingPhase,
  responseTimesRef,
  onCopyMessage, onEdit, onDeleteWithUndo, onContinue,
  onFork, onRetry, onEditResend,
}) => {
  return (
    <>
      {messages.map((msg) => (
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
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }} title={new Date(msg.timestamp).toLocaleString()}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <MessageContextMenu
              messageId={msg.id}
              content={msg.content}
              isUser={msg.role === 'user'}
              canFork={messages.length > 0}
              onCopy={onCopyMessage}
              onEdit={onEdit}
              onDelete={onDeleteWithUndo}
              onContinue={onContinue}
              onFork={() => onFork(msg.id)}
              onRetry={onRetry}
            >
              <div
                className={`p-3 sm:p-4 md:p-5 rounded-2xl relative select-none ${msg.role === 'user' ? 'bg-violet-600/10 border border-violet-500/20' : msg.error ? 'bg-rose-950/20 border border-rose-800/30' : ''}`}
                style={{
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '20px',
                  borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '20px',
                }}
              >
                {msg.thinking ? (
                  <div>
                    <ThinkingStatus phase={thinkingPhase !== 'idle' ? thinkingPhase : 'reasoning'} />
                    {liveThoughts[msg.id] || msg.thoughts ? (
                      <ThinkingPanel
                        thoughts={liveThoughts[msg.id] || msg.thoughts || ''}
                        isLive={!!liveThoughts[msg.id]}
                        isExpanded={showThoughts.has(msg.id) || !!liveThoughts[msg.id]}
                        onToggle={() => setShowThoughts(prev => {
                          const n = new Set(prev);
                          if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                          return n;
                        })}
                      />
                    ) : null}
                  </div>
                ) : msg.error ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm leading-relaxed" style={{ color: '#f87171' }}>{msg.content}</p>
                    <button onClick={() => onEditResend(msg.id)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] w-fit" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
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
                        <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }} title={new Date(msg.timestamp).toLocaleString()}>
                          {formatTimeAgo(msg.timestamp)}
                        </span>
                        {msg.thinking ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(251,191,36,0.12)', color: '#f59e0b' }}>
                            Thinking…
                          </span>
                        ) : streamingMsgId === msg.id ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full phase-badge" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            Generating…
                          </span>
                        ) : responseTimesRef.current[msg.id] ? (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                            {(responseTimesRef.current[msg.id] / 1000).toFixed(1)}s
                          </span>
                        ) : null}
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
                        {streamingMsgId === msg.id && msg.content && loading && (
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
                          if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                          return n;
                        })}
                      />
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>Sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, si) => {
                            const url = typeof src === 'string' ? src : (src as { url?: string; title?: string }).url || src;
                            const title = typeof src === 'string' ? url : (src as { url?: string; title?: string }).title || `Source ${si + 1}`;
                            const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();
                            return (
                              <a key={si} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition-all hover:scale-105" style={{ background: 'rgba(59,130,246,0.06)', color: '#94a3b8', border: '1px solid rgba(59,130,246,0.1)' }}>
                                <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" className="w-3.5 h-3.5 rounded shrink-0" loading="lazy" />
                                <span className="max-w-[140px] truncate">{title}</span>
                                <span className="text-[8px] opacity-50 shrink-0">{domain}</span>
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
    </>
  );
};

export default MessageList;
