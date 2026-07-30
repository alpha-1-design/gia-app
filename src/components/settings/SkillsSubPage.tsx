import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import { useShallow } from 'zustand/react/shallow';
import { SubPageHeader } from './SubPageHeader';

export const SkillsSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { skills, addSkill, removeSkill, addNotification } = useGiaStore(useShallow(s => ({
    skills: s.skills,
    addSkill: s.addSkill,
    removeSkill: s.removeSkill,
    addNotification: s.addNotification,
  })));

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="Neural Skills" onBack={onBack} />

      <button
        onClick={() => {
          addSkill({
            id: Math.random().toString(36).slice(2, 10),
            name: 'New Specialist', description: 'Custom AI Persona',
            systemPrompt: 'You are an expert in...', tools: ['web_search'], category: 'user'
          });
          addNotification('Skill added');
        }}
        className="gia-btn flex items-center gap-2 w-full justify-center mb-2"
        style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}
      >
        <Plus size={13} /> Add Skill
      </button>

      <div className="space-y-3">
        {skills.map(skill => (
          <div key={skill.id} className="gia-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input value={skill.name}
                  onChange={(e) => {
                    const newSkills = skills.map(s => s.id === skill.id ? { ...s, name: e.target.value } : s);
                    useGiaStore.setState({ skills: newSkills });
                  }}
                  className="text-xs font-bold bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-violet-500 outline-none transition-colors flex-1 min-w-0"
                  style={{ color: 'var(--gia-text)' }} />
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-tighter shrink-0">{skill.category}</span>
              </div>
              <button onClick={() => removeSkill(skill.id)} className="text-zinc-600 hover:text-rose-500 shrink-0 ml-2"><Trash2 size={12} /></button>
            </div>
            <textarea value={skill.systemPrompt}
              onChange={(e) => {
                const newSkills = skills.map(s => s.id === skill.id ? { ...s, systemPrompt: e.target.value } : s);
                useGiaStore.setState({ skills: newSkills });
              }}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-[10px] text-zinc-400 focus:ring-0 min-h-[60px] font-mono" />
            <div className="flex flex-wrap gap-1">
              {['web_search', 'terminal_run', 'filesystem_read', 'filesystem_write', 'image_generation', 'get_user_location', 'search_places', 'export_brain'].map(t => (
                <button key={t}
                  onClick={() => {
                    const has = skill.tools.includes(t);
                    const tools = has ? skill.tools.filter(x => x !== t) : [...skill.tools, t];
                    useGiaStore.setState({ skills: skills.map(s => s.id === skill.id ? { ...s, tools } : s) });
                  }}
                  className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${skill.tools.includes(t) ? 'border-violet-500/50 text-violet-400 bg-violet-500/5' : 'border-zinc-800 text-zinc-600'}`}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
