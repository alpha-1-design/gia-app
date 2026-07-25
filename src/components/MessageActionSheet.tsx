import React from 'react';
import { Copy, RotateCcw, Pencil, Play, GitFork, Trash2, Sparkles, Wand2, ThumbsUp, ThumbsDown, Maximize } from 'lucide-react';
import type { Message } from '../store/useGiaStore';

interface MessageActionSheetProps {
  msg: Message | null;
  onClose: () => void;
  onCopy: (id: string, content: string) => void;
  onRetry: (id: string) => void;
  onEdit: (id: string) => void;
  onContinue: (id: string) => void;
  onFork: (id: string) => void;
  onDelete: (id: string) => void;
  onRewrite: (id: string, instruction: string) => void;
  onExpand: (id: string) => void;
  reaction?: 'up' | 'down';
  onReact: (value: 'up' | 'down') => void;
  nextAssistantId?: string;
}

const REWRITE_OPTIONS: { label: string; instruction: string }[] = [
  { label: 'Simplify', instruction: 'Simplify this response so it is easy to understand. Keep the key facts. Use plainer language and shorter sentences.' },
  { label: 'Elaborate', instruction: 'Elaborate on this response with more detail, examples, and context. Keep the same conclusions.' },
  { label: 'Shorter', instruction: 'Make this response shorter and more concise. Keep only the essential points.' },
  { label: 'Casual', instruction: 'Rewrite this response in a more casual, friendly tone.' },
];

const Btn: React.FC<{ icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; active?: boolean; activeColor?: string; danger?: boolean }> = ({ icon: Icon, label, onClick, active, activeColor, danger }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors active:bg-white/5"
    style={{ color: danger ? '#f87171' : active ? (activeColor || '#22c55e') : 'var(--gia-muted)' }}
  >
    <Icon size={12} />
    <span>{label}</span>
  </button>
);

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  msg, onClose, onCopy, onRetry, onEdit, onContinue, onExpand, reaction, onReact, nextAssistantId,
}) => {
  if (!msg) return null;
  const isUser = msg.role === 'user';
  return (
    <div className="flex flex-wrap items-center gap-0.5 mt-1" style={{ color: 'var(--gia-muted)' }}>
      {isUser ? (
        <>
          <Btn icon={Pencil} label="Edit" onClick={() => { onEdit(msg.id); onClose(); }} />
          {nextAssistantId && <Btn icon={RotateCcw} label="Retry" onClick={() => { onRetry(nextAssistantId); onClose(); }} />}
        </>
      ) : (
        <>
          <Btn icon={Copy} label="Copy" onClick={() => { onCopy(msg.id, msg.content); onClose(); }} />
          <Btn icon={Maximize} label="Expand" onClick={() => { onExpand(msg.id); }} />
          <Btn icon={RotateCcw} label="Retry" onClick={() => { onRetry(msg.id); onClose(); }} />
          <Btn icon={Play} label="Continue" onClick={() => { onContinue(msg.id); onClose(); }} />
          <Btn icon={ThumbsUp} label="" onClick={() => onReact('up')} active={reaction === 'up'} />
          <Btn icon={ThumbsDown} label="" onClick={() => onReact('down')} active={reaction === 'down'} activeColor="#f87171" />
        </>
      )}
    </div>
  );
};

export const RewriteBar: React.FC<{ msgId: string; onRewrite: (id: string, instruction: string) => void; onClose: () => void; onFork: (id: string) => void; onDelete: (id: string) => void }> = ({ msgId, onRewrite, onClose, onFork, onDelete }) => (
  <div className="flex flex-wrap items-center gap-0.5 mt-0.5" style={{ color: 'var(--gia-muted)' }}>
    {REWRITE_OPTIONS.map(opt => (
      <Btn key={opt.label} icon={opt.label === 'Elaborate' ? Wand2 : Sparkles} label={opt.label} onClick={() => { onRewrite(msgId, opt.instruction); onClose(); }} />
    ))}
    <Btn icon={GitFork} label="Fork" onClick={() => { onFork(msgId); onClose(); }} />
    <Btn icon={Trash2} label="Delete" onClick={() => { onDelete(msgId); onClose(); }} danger />
  </div>
);

export default MessageActionSheet;
