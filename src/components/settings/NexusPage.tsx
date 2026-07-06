import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Search, TrendingUp, AlertTriangle, Lightbulb, GitMerge,
  Compass, Zap, Code2, Navigation2, ShieldCheck, Thermometer,
  Sun, Heart, BookOpen, Handshake, Brain, GraduationCap, Eye,
  CircleDot, Share2, Plus, X, Check, Sliders,
} from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';

interface AgentDef {
  name: string;
  color: string;
  icon: string;
  role: string;
  style: string;
}

const AGENTS: AgentDef[] = [
  { name: 'Atlas',  color: '#a855f7', icon: 'Search',       role: 'Researcher',      style: 'Thorough, detail-oriented. Gather comprehensive data and verify sources.' },
  { name: 'Nova',   color: '#f59e0b', icon: 'TrendingUp',   role: 'Analyst',         style: 'Critical, logical. Break down problems and identify patterns.' },
  { name: 'Onyx',   color: '#3b82f6', icon: 'AlertTriangle', role: 'Skeptic',        style: 'Challenge assumptions. Find flaws and edge cases.' },
  { name: 'Flux',   color: '#ec4899', icon: 'Lightbulb',    role: 'Creative',        style: 'Lateral thinking. Generate novel approaches and connections.' },
  { name: 'Vex',    color: '#10b981', icon: 'GitMerge',     role: 'Synthesizer',     style: 'Merge ideas. Combine findings into cohesive insights.' },
  { name: 'Astra',  color: '#6366f1', icon: 'Compass',      role: 'Strategist',      style: 'Big-picture thinking. Prioritize and plan.' },
  { name: 'Bolt',   color: '#ef4444', icon: 'Zap',          role: 'Critic',          style: 'Sharp but constructive. Find weaknesses and improvements.' },
  { name: 'Cipher', color: '#14b8a6', icon: 'Code2',        role: 'Technologist',    style: 'Practical, implementation-focused.' },
  { name: 'Drift',  color: '#f97316', icon: 'Navigation2',  role: 'Explorer',        style: 'Open-ended curiosity. Discover hidden connections.' },
  { name: 'Ember',  color: '#06b6d4', icon: 'ShieldCheck',  role: 'Validator',       style: 'Fact-check everything. Cross-reference sources.' },
  { name: 'Frost',  color: '#84cc16', icon: 'Thermometer',  role: 'Realist',         style: 'Practical, grounded. Focus on feasibility.' },
  { name: 'Glimmer',color: '#d946ef', icon: 'Sun',          role: 'Optimist',        style: 'Focus on opportunities and positive outcomes.' },
  { name: 'Haven',  color: '#0ea5e9', icon: 'Heart',        role: 'Ethicist',        style: 'Consider implications, fairness, responsibility.' },
  { name: 'Iris',   color: '#eab308', icon: 'BookOpen',     role: 'Archivist',       style: 'Track history and context. Find relevant patterns.' },
  { name: 'Jade',   color: '#22d3ee', icon: 'Handshake',    role: 'Diplomat',        style: 'Find common ground. Resolve conflicting viewpoints.' },
  { name: 'Krypton',color: '#8b5cf6', icon: 'Brain',        role: 'Deep Thinker',    style: 'First-principles reasoning. Drill to fundamentals.' },
  { name: 'Lumen',  color: '#fb923c', icon: 'GraduationCap', role: 'Teacher',        style: 'Explain clearly. Break complex ideas down.' },
  { name: 'Mist',   color: '#2dd4bf', icon: 'Eye',          role: 'Intuitionist',    style: 'Quick pattern recognition. Instinctive assessments.' },
  { name: 'Nyx',    color: '#a78bfa', icon: 'CircleDot',    role: 'Philosopher',     style: 'Question assumptions. Explore deeper meaning.' },
  { name: 'Orbit',  color: '#fbbf24', icon: 'Share2',       role: 'Connector',       style: 'Link disparate ideas across domains.' },
];

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Search: <Search size={15} />, TrendingUp: <TrendingUp size={15} />,
  AlertTriangle: <AlertTriangle size={15} />, Lightbulb: <Lightbulb size={15} />,
  GitMerge: <GitMerge size={15} />, Compass: <Compass size={15} />,
  Zap: <Zap size={15} />, Code2: <Code2 size={15} />,
  Navigation2: <Navigation2 size={15} />, ShieldCheck: <ShieldCheck size={15} />,
  Thermometer: <Thermometer size={15} />, Sun: <Sun size={15} />,
  Heart: <Heart size={15} />, BookOpen: <BookOpen size={15} />,
  Handshake: <Handshake size={15} />, Brain: <Brain size={15} />,
  GraduationCap: <GraduationCap size={15} />, Eye: <Eye size={15} />,
  CircleDot: <CircleDot size={15} />, Share2: <Share2 size={15} />,
};

export const NexusPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AGENTS.map(a => [a.name, true]))
  );
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [customColor, setCustomColor] = useState('#a855f7');
  const [customs, setCustoms] = useState<AgentDef[]>([]);

  const allAgents = [...AGENTS, ...customs];

  function addCustom() {
    if (!customName.trim() || !customRole.trim()) return;
    setCustoms(prev => [...prev, {
      name: customName.trim(), color: customColor, icon: 'Brain',
      role: customRole.trim(), style: customStyle.trim() || 'No custom style defined.',
    }]);
    setCustomName('');
    setCustomRole('');
    setCustomStyle('');
    setShowCustom(false);
  }

  const activeCount = allAgents.filter(a => enabled[a.name]).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)' }}>
      <div className="px-4 pt-4 pb-3 shrink-0">
        <SubPageHeader title="Nexus" onBack={onBack} />
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            {allAgents.length} agents · {activeCount} active
          </p>
          <button
            onClick={() => setShowCustom(s => !s)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium tap-feedback"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
          >
            <Plus size={12} />
            Custom Agent
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {allAgents.map((agent, i) => {
          const isOn = enabled[agent.name];
          return (
            <motion.div
              key={`${agent.name}-${i}`}
              layout
              className="rounded-xl overflow-hidden transition-all"
              style={{
                background: isOn ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)',
                border: `1px solid ${isOn ? `${agent.color}15` : 'rgba(255,255,255,0.03)'}`,
                opacity: isOn ? 1 : 0.4,
              }}
            >
              <div className="flex items-center gap-3 px-3.5 py-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}25` }}
                >
                  <span style={{ color: agent.color }}>{AGENT_ICONS[agent.icon] || <Brain size={15} />}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: isOn ? 'var(--gia-text)' : 'rgba(148,163,184,0.5)' }}>
                      {agent.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${agent.color}12`, color: agent.color }}>
                      {agent.role}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                    {agent.style}
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(p => ({ ...p, [agent.name]: !isOn }))}
                  className="w-10 h-6 rounded-full relative shrink-0 transition-all tap-feedback"
                  style={{
                    background: isOn ? agent.color : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${isOn ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full absolute top-0.5 transition-all"
                    style={{
                      background: isOn ? '#fff' : 'rgba(148,163,184,0.4)',
                      left: isOn ? 'calc(100% - 18px)' : '2px',
                      boxShadow: isOn ? `0 0 6px ${agent.color}60` : 'none',
                    }}
                  />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Custom agent creator */}
      {showCustom && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setShowCustom(false)}
        >
          <div
            className="w-full rounded-t-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--gia-surface-2)',
              border: '1px solid var(--gia-border)',
              borderBottom: 'none',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--gia-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Create Custom Agent</span>
              <button onClick={() => setShowCustom(false)} className="p-1 rounded-lg hover:bg-zinc-800"><X size={16} style={{ color: 'var(--gia-muted)' }} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>Name</p>
                <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Echo" className="w-full bg-transparent text-[13px] px-3 py-2 rounded-lg outline-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }} />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>Role</p>
                <input value={customRole} onChange={e => setCustomRole(e.target.value)} placeholder="e.g. Debugger" className="w-full bg-transparent text-[13px] px-3 py-2 rounded-lg outline-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }} />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>Thinking Style</p>
                <textarea value={customStyle} onChange={e => setCustomStyle(e.target.value)} placeholder="Describe how this agent thinks..." rows={2} className="w-full bg-transparent text-[13px] px-3 py-2 rounded-lg outline-none resize-none" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }} />
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>Color</p>
                  <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} className="w-8 h-8 rounded-lg border-0 cursor-pointer" style={{ background: 'transparent' }} />
                </div>
                <button
                  onClick={addCustom}
                  disabled={!customName.trim() || !customRole.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-medium ml-auto tap-feedback disabled:opacity-30"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
                >
                  <Check size={13} />
                  Create Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
