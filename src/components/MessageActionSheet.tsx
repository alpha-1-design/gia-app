import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, RotateCcw, Pencil, Play, GitFork, Trash2, Sparkles, X, Wand2, ThumbsUp, ThumbsDown, Maximize } from 'lucide-react';
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
  { label: 'Make it shorter', instruction: 'Make this response shorter and more concise. Keep only the essential points.' },
  { label: 'More casual tone', instruction: 'Rewrite this response in a more casual, friendly tone.' },
];

const Row: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon: Icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 text-left text-[14px] tap-feedback transition-colors active:bg-white/5"
    style={{ color: danger ? '#f87171' : 'var(--gia-text)' }}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  msg, onClose, onCopy, onRetry, onEdit, onContinue, onFork, onDelete, onRewrite, onExpand, reaction, onReact, nextAssistantId,
}) => {
  const isUser = msg?.role === 'user';
  return (
    <AnimatePresence>
      {msg && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[61] rounded-t-2xl overflow-hidden"
            style={{ background: 'var(--gia-surface)', borderTop: '1px solid var(--gia-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
                {isUser ? 'Your message' : 'GIA response'}
              </span>
              <button onClick={onClose} className="p-1 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="w-10 h-1 rounded-full mx-auto my-2" style={{ background: 'var(--gia-border)' }} />

            <div className="max-h-[60vh] overflow-y-auto pb-2">
              {isUser ? (
                <>
                  <Row icon={Pencil} label="Edit message" onClick={() => { onEdit(msg.id); onClose(); }} />
                  {nextAssistantId && (
                    <Row icon={RotateCcw} label="Retry response" onClick={() => { onRetry(nextAssistantId); onClose(); }} />
                  )}
                </>
              ) : (
                <>
                  <Row icon={Copy} label="Copy" onClick={() => { onCopy(msg.id, msg.content); onClose(); }} />
                  <Row icon={Maximize} label="Expand" onClick={() => { onExpand(msg.id); }} />
                  <Row icon={RotateCcw} label="Regenerate" onClick={() => { onRetry(msg.id); onClose(); }} />
                  <Row icon={Play} label="Continue" onClick={() => { onContinue(msg.id); onClose(); }} />
                  <Row icon={GitFork} label="Fork conversation" onClick={() => { onFork(msg.id); onClose(); }} />
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1" style={{ color: 'var(--gia-muted-2)' }}>
                    <Wand2 size={13} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Rewrite</span>
                  </div>
                  {REWRITE_OPTIONS.map(opt => (
                    <Row key={opt.label} icon={Sparkles} label={opt.label} onClick={() => { onRewrite(msg.id, opt.instruction); onClose(); }} />
                  ))}
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Was this helpful?</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { onReact('up'); }} className="p-2 rounded-lg tap-feedback transition-colors active:bg-white/5" style={{ color: reaction === 'up' ? '#22c55e' : 'var(--gia-muted)' }}>
                        <ThumbsUp size={16} />
                      </button>
                      <button onClick={() => { onReact('down'); }} className="p-2 rounded-lg tap-feedback transition-colors active:bg-white/5" style={{ color: reaction === 'down' ? '#f87171' : 'var(--gia-muted)' }}>
                        <ThumbsDown size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="h-px my-1" style={{ background: 'var(--gia-border)' }} />
                  <Row icon={Trash2} label="Delete" danger onClick={() => { onDelete(msg.id); onClose(); }} />
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MessageActionSheet;
