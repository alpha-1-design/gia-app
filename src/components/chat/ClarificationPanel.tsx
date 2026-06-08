import React from 'react';
import { motion } from 'motion/react';
import type { Clarification } from '../../store/useGiaStore';

interface ClarificationPanelProps {
  clarification: Clarification;
  clarAnswer: string;
  setClarAnswer: (val: string) => void;
  handleClarificationAnswer: (answer: string) => void;
  loading: boolean;
}

export const ClarificationPanel: React.FC<ClarificationPanelProps> = ({
  clarification,
  clarAnswer,
  setClarAnswer,
  handleClarificationAnswer,
  loading,
}) => {
  const c = clarification;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-4 py-3 mx-4 rounded-2xl"
      style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
    >
      <p className="text-xs font-medium mb-2.5 text-center leading-relaxed" style={{ color: 'var(--gia-text)' }}>{c.question}</p>
      <div className="flex flex-wrap gap-2 justify-center mb-2.5">
        {c.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => { setClarAnswer(''); handleClarificationAnswer(opt); }}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all tap-feedback disabled:opacity-40"
            style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="flex w-full gap-2">
        <input
          type="text"
          value={clarAnswer}
          onChange={(e) => setClarAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && clarAnswer.trim() && !loading) {
              handleClarificationAnswer(clarAnswer.trim());
              setClarAnswer('');
            }
          }}
          placeholder="Type your own answer..."
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none transition-colors disabled:opacity-40"
          style={{ background: 'var(--gia-surface-1)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
        />
        <button
          type="button"
          onClick={() => { handleClarificationAnswer(clarAnswer.trim()); setClarAnswer(''); }}
          disabled={loading || !clarAnswer.trim()}
          className="px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
          style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
        >
          Send
        </button>
      </div>
    </motion.div>
  );
};
