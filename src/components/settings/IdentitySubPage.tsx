import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useGiaIdentity } from '../../store/useGiaIdentity';
import { SubPageHeader } from './SubPageHeader';

export const IdentitySubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const identity = useGiaIdentity(s => s.identity);
  const { setName, setPersonality, setCustomPrompt, setTone, setFocusAreas, setProactiveness, setAllowsMemory } = useGiaIdentity();
  const [areaInput, setAreaInput] = useState('');

  const personalities: { value: 'warm' | 'professional' | 'witty' | 'direct' | 'custom'; label: string; desc: string }[] = [
    { value: 'warm', label: 'Warm', desc: 'Friendly, empathetic, approachable — default GIA' },
    { value: 'professional', label: 'Professional', desc: 'Formal, precise, business-appropriate' },
    { value: 'witty', label: 'Witty', desc: 'Humorous, playful, light-hearted' },
    { value: 'direct', label: 'Direct', desc: 'Blunt, efficient, no fluff' },
    { value: 'custom', label: 'Custom', desc: 'Write your own persona prompt' },
  ];

  const tones = ['casual', 'formal', 'technical', 'poetic', 'academic', 'playful'];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="GIA Identity" onBack={onBack} />

      <div className="gia-card p-4 flex flex-col gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>What should I be called?</label>
          <input className="gia-input mt-1" value={identity.name}
            onChange={e => setName(e.target.value)} placeholder="GIA" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Personality</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {personalities.map(p => (
              <button key={p.value}
                onClick={() => setPersonality(p.value)}
                className={`p-3 rounded-xl text-left text-[11px] border transition-all ${
                  identity.personalityStyle === p.value
                    ? 'border-violet-500/50 bg-violet-500/5 text-violet-400'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}>
                <span className="font-semibold block">{p.label}</span>
                <span className="text-[9px] mt-1 block opacity-70">{p.desc}</span>
              </button>
            ))}
          </div>
          {identity.personalityStyle === 'custom' && (
            <textarea className="gia-input mt-2 min-h-[60px] font-mono text-[11px]" value={identity.customPrompt}
              onChange={e => setCustomPrompt(e.target.value)} placeholder="Describe how GIA should behave..." />
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Tone</label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tones.map(t => (
              <button key={t} onClick={() => setTone(t)}
                className={`text-[10px] px-3 py-1.5 rounded-full border transition-all ${
                  identity.tone === t
                    ? 'border-violet-500/50 text-violet-400 bg-violet-500/5'
                    : 'border-zinc-800 text-zinc-500'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Focus Areas (subjects GIA should prioritize)</label>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
            {identity.focusAreas.map(area => (
              <span key={area} className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
                {area}
                <button onClick={() => setFocusAreas(identity.focusAreas.filter(a => a !== area))} className="hover:text-white">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="gia-input flex-1" value={areaInput}
              onChange={e => setAreaInput(e.target.value)}
              placeholder="e.g. coding, math, health" />
            <button onClick={() => {
              if (areaInput.trim() && !identity.focusAreas.includes(areaInput.trim())) {
                setFocusAreas([...identity.focusAreas, areaInput.trim()]);
                setAreaInput('');
              }
            }}
              className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Proactiveness</label>
            <span className="text-xs" style={{ color: 'var(--gia-text)' }}>
              {identity.proactiveness < 0.3 ? 'Reserved' : identity.proactiveness > 0.7 ? 'Proactive' : 'Balanced'}
            </span>
          </div>
          <input type="range" min="0" max="1" step="0.1" value={identity.proactiveness}
            onChange={e => setProactiveness(parseFloat(e.target.value))}
            className="w-full mt-2 accent-violet-500" />
          <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
            <span>Wait for instructions</span>
            <span>Proactive suggestions</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--gia-muted)' }}>Allow Memory</label>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>Let GIA remember you across conversations</p>
          </div>
          <button onClick={() => setAllowsMemory(!identity.allowsMemory)}
            className={`w-10 h-5 rounded-full transition-all relative ${identity.allowsMemory ? 'bg-violet-500' : 'bg-zinc-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${identity.allowsMemory ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
