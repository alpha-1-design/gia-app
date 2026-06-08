import React from 'react';
import { Sparkles, GraduationCap, Code2, BookOpen, Zap } from 'lucide-react';

const QUICK_STARTS = [
  { icon: GraduationCap, label: 'Exam Prep', prompt: 'Quiz me on WASSCE past questions for', color: '#a855f7' },
  { icon: BookOpen, label: 'BECE Prep', prompt: 'Help me study for BECE — topic:', color: '#3b82f6' },
  { icon: Code2, label: 'Code Help', prompt: 'Explain and fix this code:', color: '#ec4899' },
  { icon: Sparkles, label: 'Summarize URL', prompt: 'Summarize this URL: https://', color: '#10b981' },
  { icon: Zap, label: 'Plan My Week', prompt: 'Help me plan my study week. My exams are:', color: '#f59e0b' },
];

interface QuickStartsProps {
  setInput: (val: string) => void;
}

export const QuickStarts: React.FC<QuickStartsProps> = ({ setInput }) => {
  return (
    <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-1">
      {QUICK_STARTS.map((qs) => (
        <button key={qs.label} onClick={() => setInput(qs.prompt)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all tap-feedback bg-zinc-900/50 border border-zinc-800 hover:border-violet-500/30">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${qs.color}20` }}><qs.icon size={14} style={{ color: qs.color }} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{qs.label}</p>
            <p className="text-[10px] truncate text-zinc-500">{qs.prompt}</p>
          </div>
        </button>
      ))}
    </div>
  );
};
