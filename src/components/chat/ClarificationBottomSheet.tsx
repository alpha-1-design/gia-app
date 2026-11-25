import React, { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import type { Clarification } from '../../store/useGiaStore';
import BottomSheet from '../ui/BottomSheet';

interface ClarificationBottomSheetProps {
  clarification: Clarification;
  clarAnswer: string;
  setClarAnswer: (val: string) => void;
  handleClarificationAnswer: (answer: string) => void;
  loading: boolean;
  onDismiss: () => void;
}

// Migrated to the shared BottomSheet primitive (enter/exit, backdrop,
// grabber, drag-to-dismiss all come from it). Props and content unchanged.
// The parent unmounts this component the moment onDismiss clears the
// clarification, which would skip the slide-out animation — so dismissal
// flips the sheet closed first and defers onDismiss until the exit
// transition (~spring) has visually completed.
const DISMISS_EXIT_MS = 340;

export const ClarificationBottomSheet: React.FC<ClarificationBottomSheetProps> = ({
  clarification,
  clarAnswer,
  setClarAnswer,
  handleClarificationAnswer,
  loading,
  onDismiss,
}) => {
  const c = clarification;
  const [visible, setVisible] = useState(true);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissingRef = useRef(false);

  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  const dismiss = () => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setVisible(false);
    dismissTimerRef.current = setTimeout(onDismiss, DISMISS_EXIT_MS);
  };

  return (
    <BottomSheet open={visible} onClose={dismiss} zIndex={50}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarification-title"
        className="relative rounded-t-2xl"
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
            onClick={dismiss}
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
                  onClick={() => { setClarAnswer(''); handleClarificationAnswer(opt); dismiss(); }}
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
                  dismiss();
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
              onClick={() => { handleClarificationAnswer(clarAnswer.trim()); setClarAnswer(''); dismiss(); }}
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
    </BottomSheet>
  );
};
