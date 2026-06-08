import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send } from 'lucide-react';
import type { Clarification } from '../../store/useGiaStore';

interface ClarificationBottomSheetProps {
  clarification: Clarification;
  clarAnswer: string;
  setClarAnswer: (val: string) => void;
  handleClarificationAnswer: (answer: string) => void;
  loading: boolean;
  onDismiss: () => void;
}

export const ClarificationBottomSheet: React.FC<ClarificationBottomSheetProps> = ({
  clarification,
  clarAnswer,
  setClarAnswer,
  handleClarificationAnswer,
  loading,
  onDismiss,
}) => {
  const c = clarification;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end"
        onClick={onDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarification-title"
      >
        <motion.div
          className="w-full"
          onClick={(e) => e.stopPropagation()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-transparent" />
          <div
            className="relative rounded-t-2xl overflow-hidden"
            style={{
              background: 'var(--gia-surface-2)',
              border: '1px solid var(--gia-border)',
              borderBottom: 'none',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--gia-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
                <span id="clarification-title" className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
                  Clarification Needed
                </span>
              </div>
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                style={{ color: 'var(--gia-muted)' }}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 pb-6 space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--gia-text)' }}>{c.question}</p>

              {c.options && c.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {c.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setClarAnswer(''); handleClarificationAnswer(opt); onDismiss(); }}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all tap-feedback disabled:opacity-40"
                      style={{
                        background: 'rgba(168,85,247,0.12)',
                        color: '#a855f7',
                        border: '1px solid rgba(168,85,247,0.25)',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={clarAnswer}
                  onChange={(e) => setClarAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && clarAnswer.trim() && !loading) {
                      handleClarificationAnswer(clarAnswer.trim());
                      setClarAnswer('');
                      onDismiss();
                    }
                  }}
                  placeholder="Type your own answer..."
                  disabled={loading}
                  autoFocus
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-colors disabled:opacity-40"
                  style={{
                    background: 'var(--gia-surface-1)',
                    color: 'var(--gia-text)',
                    border: '1px solid var(--gia-border)',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => { handleClarificationAnswer(clarAnswer.trim()); setClarAnswer(''); onDismiss(); }}
                  disabled={loading || !clarAnswer.trim()}
                  className="px-5 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(168,85,247,0.15)',
                    color: '#a855f7',
                    border: '1px solid rgba(168,85,247,0.3)',
                  }}
                >
                  <Send size={14} /> Send
                </button>
              </div>

              <div className="h-8" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};