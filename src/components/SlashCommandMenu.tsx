import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Skill } from '../store/useGiaStore';
import { Zap, Shield, Code, Palette, Slash, X, Search } from 'lucide-react';
import type { SlashCommandMeta } from '../services/SlashCommands';

interface SlashCommandMenuProps {
  commands: SlashCommandMeta[];
  skills: Skill[];
  activeSkillId: string | null;
  query: string;
  onPickCommand: (cmd: SlashCommandMeta) => void;
  onPickSkill: (id: string) => void;
  onClose: () => void;
}

const CATEGORY_ICONS = {
  core: <Shield size={12} className="text-zinc-400" />,
  user: <Zap size={12} className="text-amber-400" />,
  dev: <Code size={12} className="text-blue-400" />,
  creative: <Palette size={12} className="text-pink-400" />,
};

type Entry =
  | { kind: 'command'; meta: SlashCommandMeta }
  | { kind: 'skill'; skill: Skill };

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  commands, skills, activeSkillId, query, onPickCommand, onPickSkill, onClose,
}) => {
  const q = query.trim().toLowerCase();
  const entries = useMemo<Entry[]>(() => {
    const cmds: Entry[] = commands
      .filter(c => !q || c.name.includes(q) || c.aliases.some(a => a.includes(q)) || c.description.toLowerCase().includes(q))
      .map(meta => ({ kind: 'command', meta }));
    const skls: Entry[] = skills
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .map(skill => ({ kind: 'skill', skill }));
    return [...cmds, ...skls];
  }, [commands, skills, q]);

  const rows = useMemo(() => entries.filter(e => {
    if (q) return true;
    // Bare "/": show every command, then skills grouped after a divider.
    return e.kind === 'command' || true;
  }), [entries, q]);

  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelected(0); }, [q, entries.length]);

  const pick = (e: Entry) => {
    if (e.kind === 'command') onPickCommand(e.meta);
    else onPickSkill(e.skill.id);
  };

  const pickAt = (i: number) => {
    const e = rows[i];
    if (e) {
      pick(e);
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }
  };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setSelected(s => Math.min(s + 1, rows.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); pickAt(selected); }
    else if (ev.key === 'Escape') { ev.preventDefault(); onClose(); }
  };

  const hasCommands = rows.some(r => r.kind === 'command');
  const hasSkills = rows.some(r => r.kind === 'skill');

  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 outline-none"
        style={{ background: 'rgba(13, 13, 18, 0.98)', backdropFilter: 'blur(30px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Slash size={14} className="text-violet-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">GIA Slash Commands</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/70">
          <Search size={12} className="text-zinc-500" />
          <span className="text-[11px] text-zinc-500 truncate">
            {q ? `Filtering for "/${query}"` : 'Commands and skills — tap to run'}
          </span>
        </div>

        <div ref={listRef} className="p-2 max-h-[60vh] overflow-y-auto space-y-1 custom-scrollbar">
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">
              No commands or skills match <span className="text-violet-400">/{query}</span>
            </p>
          )}

          {hasCommands && (
            <p className="px-3 pt-1.5 pb-0.5 text-[9px] uppercase tracking-[0.18em] font-bold text-zinc-500">Commands</p>
          )}
          {rows.filter(r => r.kind === 'command').map((e) => {
            const i = rows.indexOf(e);
            const meta = (e as { kind: 'command'; meta: SlashCommandMeta }).meta;
            return (
              <button
                key={`cmd-${meta.name}`}
                onClick={() => pick(e)}
                onMouseEnter={() => setSelected(i)}
                data-active={i === selected}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left transition-all ${
                  i === selected ? 'bg-violet-600/15 border border-violet-500/25' : 'bg-transparent border border-transparent'
                }`}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-zinc-800">
                  <Slash size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-zinc-100">/{meta.name}</p>
                    {meta.aliases.map(a => (
                      <span key={a} className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold">/{a}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{meta.description}</p>
                </div>
                {meta.args ? (
                  <div className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold uppercase tracking-wide shrink-0">arg</div>
                ) : (
                  <div className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wide shrink-0">Run</div>
                )}
              </button>
            );
          })}

          {hasCommands && hasSkills && (
            <div className="pt-1 pb-0.5">
              <p className="px-3 text-[9px] uppercase tracking-[0.18em] font-bold text-zinc-500">Skills</p>
            </div>
          )}

          {rows.filter(r => r.kind === 'skill').map((e) => {
            const i = rows.indexOf(e);
            const skill = (e as { kind: 'skill'; skill: Skill }).skill;
            const active = activeSkillId === skill.id;
            return (
              <button
                key={`skill-${skill.id}`}
                onClick={() => pick(e)}
                onMouseEnter={() => setSelected(i)}
                data-active={i === selected}
                className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-2xl text-left transition-all ${
                  i === selected
                    ? 'bg-violet-600/15 border border-violet-500/25'
                    : active ? 'bg-violet-600/10 border border-violet-500/20' : 'bg-transparent border border-transparent'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-violet-500/20' : 'bg-zinc-800'}`}>
                  {CATEGORY_ICONS[skill.category as keyof typeof CATEGORY_ICONS] || <Zap size={14} className="text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-zinc-100">{skill.name}</p>
                    {active && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-bold uppercase tracking-tighter">Active</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{skill.description}</p>
                </div>
                {active && <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/20">
          <p className="text-[9px] text-center text-zinc-600 uppercase tracking-widest font-medium">
            ↑↓ navigate · ↵ run · esc close
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SlashCommandMenu;