import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { TOOL_META } from './WorkLog';
import type { MessageSegment } from '../store/useGiaStore';

/**
 * Renders a message's think -> tool -> think -> tool sequence as discrete,
 * ordered blocks instead of one collapsed panel. This is the direct
 * replacement for the old behavior where every thinking/tool-lifecycle
 * line got flattened into a single `thoughts` string and shown as one
 * blob either above the response or behind a single "show reasoning"
 * toggle -- there was no way to see the actual back-and-forth.
 *
 * `text` segments are intentionally not rendered here -- the final
 * response text is already shown via MarkdownRenderer against
 * msg.content, which already contains everything text segments would
 * duplicate. This component only owns the "how did it get there" trail.
 */

function ToolBlock({ segment, defaultOpen }: { segment: MessageSegment; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = (segment.toolName && TOOL_META[segment.toolName]) || null;
  const label = meta?.label || segment.toolName || 'Using a tool';
  const color = meta?.color || '#8b5cf6';
  const icon = meta?.icon || <Brain size={12} />;

  const statusIcon = segment.toolStatus === 'running'
    ? <Loader2 size={11} className="animate-spin" style={{ color }} />
    : segment.toolStatus === 'failed'
      ? <AlertCircle size={11} style={{ color: '#f87171' }} />
      : <CheckCircle size={11} style={{ color: '#34d399' }} />;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${color}22`, background: `${color}0a` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
        style={{ color }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] font-medium flex-1">{label}</span>
        {statusIcon}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <pre className="px-2.5 pb-2 text-[10px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gia-muted)', fontFamily: 'inherit' }}>
              {segment.content}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThinkingBlock({ segment, defaultOpen }: { segment: MessageSegment; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const preview = segment.content.trim().split('\n')[0]?.slice(0, 60) || 'Thinking';

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(251,191,36,0.12)', background: 'rgba(251,191,36,0.03)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
        style={{ color: '#f59e0b' }}
      >
        <Brain size={12} />
        <span className="text-[11px] font-medium flex-1 truncate">{open ? 'Thinking' : preview}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <p className="px-2.5 pb-2 text-[10px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gia-muted)' }}>
              {segment.content.trim()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SegmentedReasoning({
  segments,
  isLive,
}: {
  segments: MessageSegment[];
  isLive: boolean;
}) {
  // Only the trail, not the final answer -- see file header.
  const trail = useMemo(() => segments.filter(s => s.type !== 'text'), [segments]);
  if (trail.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mb-3">
      {trail.map((seg, i) => {
        const isLast = i === trail.length - 1;
        // Auto-expand only the currently-active segment while streaming;
        // everything else starts collapsed so a long tool trail doesn't
        // dominate the message -- this mirrors how Claude keeps earlier
        // steps collapsed once the model has moved on.
        const defaultOpen = isLive && isLast;
        return seg.type === 'tool'
          ? <ToolBlock key={seg.id} segment={seg} defaultOpen={defaultOpen} />
          : <ThinkingBlock key={seg.id} segment={seg} defaultOpen={defaultOpen} />;
      })}
    </div>
  );
}
