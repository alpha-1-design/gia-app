import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Wrench, ShieldAlert } from 'lucide-react';
import InlineToolExecution from './InlineToolExecution';
import { TOOL_LABELS } from '../utils/toolLabels';
import type { ProtocolProposal } from '../types/protocol';

interface ToolTrayProps {
  protocols: ProtocolProposal[];
}

const labelFor = (p: ProtocolProposal): string =>
  TOOL_LABELS[p.type] || p.type?.replace(/_/g, ' ') || 'tool';

// Claude/Grok-style tool display: a single calm, collapsible row by default
// that expands to the full InlineToolExecution cards on tap. Nothing is
// removed — the detail is always one tap away.
const ToolTray: React.FC<ToolTrayProps> = ({ protocols }) => {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...protocols].sort((a, b) => a.createdAt - b.createdAt);
  const executing = sorted.some((p) => p.state === 'executing' || p.state === 'proposed' || p.state === 'confirmed');
  const needsApproval = sorted.some((p) => p.state === 'proposed');
  const anyFailed = sorted.some((p) => p.state === 'failed');
  const doneCount = sorted.filter((p) => p.state === 'completed').length;

  // Auto-expand when tools need user approval so the approve/reject
  // buttons are immediately visible instead of hidden behind a tap.
  useEffect(() => {
    if (needsApproval) setExpanded(true);
  }, [needsApproval]);

  if (protocols.length === 0) return null;

  const names = sorted.slice(0, 2).map(labelFor);
  const extra = Math.max(0, sorted.length - names.length);
  const summary = names.join(' · ') + (extra > 0 ? ` +${extra}` : '');

  const dotColor = anyFailed ? '#ef4444' : needsApproval ? '#eab308' : executing ? '#a855f7' : '#22c55e';

  return (
    <div
      className="mt-3 rounded-2xl overflow-hidden"
      style={{
        border: needsApproval
          ? '1px solid rgba(234,179,8,0.25)'
          : '1px solid rgba(168,85,247,0.14)',
        background: needsApproval
          ? 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.02))'
          : 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(168,85,247,0.01))',
      }}
    >
      <motion.button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        whileTap={{ scale: 0.99 }}
        style={{ background: 'transparent' }}
      >
        <span className="relative flex items-center justify-center w-5 h-5">
          {executing ? (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: dotColor, opacity: 0.25 }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.25, 0, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <span
            className="relative w-2 h-2 rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}88` }}
          />
        </span>

        {needsApproval ? <ShieldAlert size={13} style={{ color: '#eab308' }} /> : <Wrench size={13} style={{ color: '#a855f766' }} />}

        <span className="flex-1 min-w-0 text-[12px] font-medium truncate" style={{ color: needsApproval ? '#fde68a' : '#d8c8f0' }}>
          {needsApproval ? 'Approval needed' : executing ? 'Working' : doneCount > 0 ? `Used ${sorted.length} tool${sorted.length > 1 ? 's' : ''}` : 'Tools'}
          <span className="opacity-60 font-normal"> — {summary}</span>
        </span>

        <span className="text-[10px] tabular-nums" style={{ color: needsApproval ? '#eab308' : '#a855f799' }}>
          {doneCount}/{sorted.length}
        </span>

        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
          <ChevronDown size={14} style={{ color: needsApproval ? '#eab308' : '#a855f7' }} />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30, opacity: { duration: 0.18 } }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3 pt-0.5 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider px-0.5 pt-1" style={{ color: 'var(--gia-muted)' }}>
                Tool calls
              </p>
              {sorted.map((p, pi) => (
                <InlineToolExecution key={p.id} protocol={p} index={pi} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolTray;
