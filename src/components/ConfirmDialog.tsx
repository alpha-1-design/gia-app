import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, onConfirm, onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="rounded-2xl p-5 mx-4 max-w-sm w-full shadow-2xl"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold mb-2" style={{ color: danger ? '#f87171' : 'var(--gia-text)' }}>
              {title}
            </p>
            <p className="text-[12px] mb-5" style={{ color: 'var(--gia-muted)' }}>
              {message}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancel}
                className="text-xs px-4 py-2 rounded-xl transition-all"
                style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className="text-xs px-4 py-2 rounded-xl transition-all font-medium"
                style={{
                  background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(168,85,247,0.15)',
                  border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  color: danger ? '#f87171' : '#a855f7',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
