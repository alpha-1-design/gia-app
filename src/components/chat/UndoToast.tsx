import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Undo2 } from 'lucide-react';

interface UndoToastProps {
  undoMsg: { id: string; sessionId: string; backup: unknown[] } | null;
  handleUndoDelete: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ undoMsg, handleUndoDelete }) => {
  return (
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
  );
};
