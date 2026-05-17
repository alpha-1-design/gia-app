import React from 'react';
import { motion } from 'framer-motion';
import { Skill } from '../store/useGiaStore';
import { Zap, Shield, Code, Palette, X } from 'lucide-react';

interface SkillPickerProps {
  skills: Skill[];
  activeSkillId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const CATEGORY_ICONS = {
  core: <Shield size={12} className="text-zinc-400" />,
  user: <Zap size={12} className="text-amber-400" />,
  dev: <Code size={12} className="text-blue-400" />,
  creative: <Palette size={12} className="text-pink-400" />,
};

const SkillPicker: React.FC<SkillPickerProps> = ({ skills, activeSkillId, onSelect, onClose }) => {
  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-zinc-800"
        style={{ background: 'rgba(13, 13, 18, 0.98)', backdropFilter: 'blur(30px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">GIA Neural Command Palette</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500">
            <X size={14} />
          </button>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1 custom-scrollbar">
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => onSelect(skill.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all ${
                activeSkillId === skill.id
                ? 'bg-violet-600/10 border border-violet-500/20'
                : 'hover:bg-zinc-800/50 border border-transparent'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeSkillId === skill.id ? 'bg-violet-500/20' : 'bg-zinc-800'
              }`}>
                {CATEGORY_ICONS[skill.category as keyof typeof CATEGORY_ICONS] || <Zap size={14} className="text-zinc-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-zinc-100">{skill.name}</p>
                  {activeSkillId === skill.id && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-bold uppercase tracking-tighter">Active</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{skill.description}</p>
              </div>
              {activeSkillId === skill.id && (
                <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/20">
          <p className="text-[9px] text-center text-zinc-600 uppercase tracking-widest font-medium">Select a skill to reprogram GIA's core</p>
        </div>
      </motion.div>
    </div>
  );
};

const Sparkles = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M3 5h4"/><path d="M21 17v4"/><path d="M19 19h4"/>
  </svg>
);

export default SkillPicker;
