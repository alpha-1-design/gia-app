import React from 'react';
import { Sparkles, GraduationCap, Code2, BookOpen, Zap, Brain, Globe, PenLine, Calculator } from 'lucide-react';

const QUICK_STARTS = [
  { icon: GraduationCap, label: 'WASSCE Prep', prompt: 'Quiz me on WASSCE past questions for ', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  { icon: BookOpen,      label: 'BECE Prep',   prompt: 'Help me study for BECE — topic: ',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { icon: Code2,         label: 'Fix Code',    prompt: 'Explain and fix this code:\n',        color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { icon: Globe,         label: 'Summarize URL', prompt: 'Summarize this URL: https://',      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { icon: Zap,           label: 'Plan Week',   prompt: 'Help me plan my study week. My exams are: ', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { icon: Brain,         label: 'Explain',     prompt: 'Explain this concept simply: ',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { icon: PenLine,       label: 'Write',       prompt: 'Write a ',                            color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { icon: Calculator,    label: 'Solve Math',  prompt: 'Solve this step by step: ',           color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { icon: Sparkles,      label: 'Surprise Me', prompt: 'Teach me something fascinating about ', color: '#e879f9', bg: 'rgba(232,121,249,0.12)' },
];

interface QuickStartsProps {
  setInput: (val: string) => void;
}

export const QuickStarts: React.FC<QuickStartsProps> = ({ setInput }) => {
  return (
    <div className="w-full mt-2">
      {/* Horizontal scroll row — no scrollbar shown */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: '1px',
          paddingRight: '1px',
        }}
      >
        <style>{`.qs-scroll::-webkit-scrollbar { display: none; }`}</style>
        {QUICK_STARTS.map((qs) => (
          <button
            key={qs.label}
            onClick={() => setInput(qs.prompt)}
            className="flex flex-col items-center gap-1.5 shrink-0 rounded-2xl tap-feedback transition-all"
            style={{
              width: '72px',
              padding: '10px 6px 8px',
              background: qs.bg,
              border: `1px solid ${qs.color}25`,
            }}
          >
            {/* Icon circle */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${qs.color}18`, border: `1px solid ${qs.color}20` }}
            >
              <qs.icon size={15} style={{ color: qs.color }} />
            </div>
            {/* Label */}
            <span
              className="text-center leading-tight font-medium"
              style={{
                fontSize: '9px',
                color: 'var(--gia-muted)',
                lineHeight: '1.2',
                wordBreak: 'break-word',
                maxWidth: '60px',
              }}
            >
              {qs.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
