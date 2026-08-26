import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, RotateCcw, ThumbsUp, ThumbsDown, Maximize } from 'lucide-react';
import type { Message } from '../store/useGiaStore';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  msg: Message | null;
  reaction?: 'up' | 'down';
  onClose: () => void;
  onCopy: (id: string, content: string) => void;
  onRegenerate: (id: string) => void;
  onReact: (value: 'up' | 'down') => void;
}

const Row: React.FC<{ icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void; active?: boolean }> = ({ icon: Icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl tap-feedback transition-colors active:bg-white/5"
    style={{ color: active ? 'var(--gia-accent)' : 'var(--gia-muted)' }}
  >
    <Icon size={18} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const MessageFullScreen: React.FC<Props> = ({ msg, reaction, onClose, onCopy, onRegenerate, onReact }) => {
  return createPortal(
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: 'var(--gia-bg)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)', background: 'var(--gia-surface)', paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2 min-w-0">
              <Maximize size={16} style={{ color: 'var(--gia-accent)' }} />
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>GIA</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl tap-feedback transition-colors hover:bg-white/10"
              style={{ color: 'var(--gia-muted)' }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="w-full px-4 py-5">
              <MarkdownRenderer content={msg.content} sources={msg.sources} />
            </div>
          </div>

          <div className="flex items-center justify-around px-2 py-1 shrink-0" style={{ borderTop: '1px solid var(--gia-border)', background: 'var(--gia-surface)' }}>
            <Row icon={Copy} label="Copy" onClick={() => { onCopy(msg.id, msg.content); }} />
            <Row icon={RotateCcw} label="Regenerate" onClick={() => { onRegenerate(msg.id); onClose(); }} />
            <Row icon={ThumbsUp} label="Like" onClick={() => onReact('up')} active={reaction === 'up'} />
            <Row icon={ThumbsDown} label="Dislike" onClick={() => onReact('down')} active={reaction === 'down'} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default React.memo(MessageFullScreen);
