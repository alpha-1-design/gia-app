import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Terminal, Shield, User, X, Save, ChevronRight,
  Wifi, WifiOff, Cpu, Trash2, Brain, Search, Play, Check,
  Code2, Headphones, Smartphone, ExternalLink, Mail, Globe, Lock,
  Plus, Zap, Sparkles
} from 'lucide-react';
import { useGiaStore, Skill } from '../store/useGiaStore';
import { useProviderStore, PROVIDER_DEFAULTS, ProviderType } from '../store/useProviderStore';
import CodeRunner from '../services/CodeRunner';
import { useMemoryStore, MemoryCategory } from '../store/useMemoryStore';
import QRCode from 'qrcode';

const ALL_PROVIDERS: ProviderType[] = ['openrouter', 'anthropic', 'openai', 'gemini', 'groq', 'opencode'];

const PROVIDER_COLORS: Record<ProviderType, string> = {
  openrouter: '#6366f1',
  anthropic:  '#d97706',
  openai:     '#10a37f',
  gemini:     '#4285f4',
  groq:       '#f97316',
  opencode:   '#8b5cf6',
};

const SettingsModule: React.FC = () => {
  const { 
    setShowTerminal, userProfile, setUserProfile, notifications, 
    clearNotification, skills, addSkill, removeSkill, addNotification 
  } = useGiaStore();
  const { providers, activeProvider } = useProviderStore();

  const [editProfile, setEditProfile] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [bio, setBio] = useState(userProfile.bio);
  const [goals, setGoals] = useState(userProfile.goals);
  const [codeEndpoint, setCodeEndpoint] = useState(() => localStorage.getItem('gia-piston-endpoint') || '');

  const saveProfile = () => {
    setUserProfile({ name: name.trim(), bio: bio.trim(), goals: goals.trim() });
    setEditProfile(false);
  };

  const connectedCount = ALL_PROVIDERS.filter(p => providers[p]?.enabled).length;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}
    >
      {/* Profile */}
      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={14} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
              Your Profile
            </span>
          </div>
          <button
            onClick={() => setEditProfile(e => !e)}
            className="text-[11px] font-medium"
            style={{ color: '#a855f7' }}
          >
            {editProfile ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Your name', val: name, set: setName, placeholder: 'e.g. Samuel' },
              { label: 'About you', val: bio, set: setBio, placeholder: 'e.g. WASSCE student in Ghana' },
              { label: 'Goals', val: goals, set: setGoals, placeholder: 'e.g. Pass WASSCE, ship my app' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
                  {f.label}
                </label>
                <input
                  className="gia-input"
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <button onClick={saveProfile} className="gia-btn gia-btn-primary w-full mt-1">
              <Save size={13} /> Save Profile
            </button>
          </div>
        ) : (
          <div>
            {userProfile.name ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{userProfile.name}</p>
                {userProfile.bio && <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>{userProfile.bio}</p>}
                {userProfile.goals && (
                  <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#a855f7' }}>
                    ✦ {userProfile.goals}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
                No profile set — add your name so GIA can personalise responses.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Engine Room CTA */}
      <button
        onClick={() => setShowTerminal(true)}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback"
        style={{ transition: 'border-color 0.2s' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#0d0d14', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <Terminal size={18} style={{ color: '#34d399' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Engine Room</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            Connect providers · select models
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="gia-pill" style={{
            background: connectedCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
            color: connectedCount > 0 ? '#34d399' : 'var(--gia-muted)',
            border: `1px solid ${connectedCount > 0 ? 'rgba(16,185,129,0.2)' : 'var(--gia-border)'}`,
          }}>
            {connectedCount}/{ALL_PROVIDERS.length}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
        </div>
      </button>

      {/* Skills Management */}
      <div className="gia-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
              Neural Skills
            </span>
          </div>
          <button 
            onClick={() => {
              addSkill({
                id: Math.random().toString(36).slice(2, 10),
                name: 'New Specialist',
                description: 'Custom AI Persona',
                systemPrompt: 'You are an expert in...',
                tools: ['web_search'],
                category: 'user'
              });
              addNotification('Skill added');
            }}
            className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {skills.map(skill => (
            <div key={skill.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    value={skill.name}
                    onChange={(e) => {
                      const newSkills = skills.map(s => s.id === skill.id ? { ...s, name: e.target.value } : s);
                      useGiaStore.setState({ skills: newSkills });
                    }}
                    className="text-xs font-bold bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-violet-500 outline-none transition-colors flex-1 min-w-0"
                    style={{ color: 'var(--gia-text)' }}
                  />
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase tracking-tighter shrink-0">{skill.category}</span>
                </div>
                <button onClick={() => removeSkill(skill.id)} className="text-zinc-600 hover:text-rose-500 shrink-0 ml-2"><Trash2 size={12} /></button>
              </div>
              <textarea 
                value={skill.systemPrompt}
                onChange={(e) => {
                  const newSkills = skills.map(s => s.id === skill.id ? { ...s, systemPrompt: e.target.value } : s);
                  useGiaStore.setState({ skills: newSkills });
                }}
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg p-2 text-[10px] text-zinc-400 focus:ring-0 min-h-[60px] font-mono"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {['web_search', 'terminal_run', 'filesystem_read', 'filesystem_write', 'image_generation'].map(t => (
                  <button 
                    key={t}
                    onClick={() => {
                      const has = skill.tools.includes(t);
                      const tools = has ? skill.tools.filter(x => x !== t) : [...skill.tools, t];
                      const newSkills = skills.map(s => s.id === skill.id ? { ...s, tools } : s);
                      useGiaStore.setState({ skills: newSkills });
                    }}
                    className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${skill.tools.includes(t) ? 'border-violet-500/50 text-violet-400 bg-violet-500/5' : 'border-zinc-800 text-zinc-600'}`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <MemorySection />

      <div className="gia-card p-4 flex items-start gap-3">
        <Shield size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Advanced Permissions</p>
          <p className="text-[11px] mt-1 text-zinc-500 leading-relaxed">
            Enable <strong>Display over other apps</strong> to allow GIA to wake up and appear over your current task when you say the wake word.
          </p>
          <button 
            onClick={() => {
              addNotification('Opening settings. Enable "Display over other apps" manually.');
              alert('Please go to Settings > Apps > GIA > Display over other apps (or Overlay) and enable it to allow GIA to wake up over other apps.');
            }}
            className="gia-btn mt-3 text-[10px] px-3 py-1.5 border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
          >
            Grant Overlay Permission
          </button>
        </div>
      </div>

      <VoiceSection />
      <SecuritySection />
      <CodeExecutionSection codeEndpoint={codeEndpoint} setCodeEndpoint={setCodeEndpoint} />
      <CodeHistorySection />
      <InstallSection />

      {/* Danger zone */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#f87171' }}>Danger Zone</p>
        <button
          onClick={() => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
              useGiaStore.setState({ sessions: [], activeSessionId: null });
              setTimeout(() => useGiaStore.getState().createSession(), 0);
            }
          }}
          className="gia-btn flex items-center gap-2 w-full"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <Trash2 size={13} /> Clear All Chats
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] py-2" style={{ color: 'var(--gia-muted-2)' }}>
        GIA v2.3.1 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
      </p>
    </div>
  );
};

const MemorySection: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const memories = useMemoryStore((s) => s.memories);
  const deleteMemory = useMemoryStore((s) => s.deleteMemory);
  const clearMemories = useMemoryStore((s) => s.clearMemories);

  const filtered = filter
    ? memories.filter(m => m.key.toLowerCase().includes(filter.toLowerCase()) || m.value.toLowerCase().includes(filter.toLowerCase()))
    : memories;

  const CATEGORY_COLORS: Record<MemoryCategory, string> = {
    profile: '#a855f7',
    subject: '#3b82f6',
    score: '#10b981',
    weak_area: '#f59e0b',
    fact: '#8888a0',
    preference: '#ec4899',
    session_summary: '#6366f1',
    project: '#22d3ee',
    correction: '#fb923c',
    emotion: '#f472b6',
    goal: '#34d399',
  };

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => setExpanded(e => !e)} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: '#a855f7' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Memory ({memories.length})
          </span>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="relative">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
            <input
              className="gia-input"
              style={{ paddingLeft: '28px', fontSize: '12px' }}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search memories..."
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-[11px] text-center py-4" style={{ color: 'var(--gia-muted-2)' }}>
              {memories.length === 0 ? 'No memories yet. Chat with GIA to build them.' : 'No matches.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filtered.map(m => (
                <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: CATEGORY_COLORS[m.category] || '#8888a0' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--gia-text)' }}>{m.key}</span>
                      <span className="text-[8px] px-1 rounded" style={{ background: `${CATEGORY_COLORS[m.category]}20`, color: CATEGORY_COLORS[m.category] }}>{m.category}</span>
                    </div>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--gia-muted)' }}>{m.value}</p>
                  </div>
                  <button onClick={() => deleteMemory(m.id)} className="text-zinc-600 hover:text-rose-400 p-1 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {memories.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear all memories? This cannot be undone.')) clearMemories(); }}
              className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg w-full"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <Trash2 size={10} /> Clear All Memories
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CodeExecutionSection: React.FC<{ codeEndpoint: string; setCodeEndpoint: (v: string) => void }> = ({ codeEndpoint, setCodeEndpoint }) => {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [showLangs, setShowLangs] = useState(false);
  const [runtimes, setRuntimes] = useState<{ language: string; version: string }[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(false);

  const handleTest = useCallback(async () => {
    setTestState('testing');
    setTestMsg('');
    const url = codeEndpoint.trim() || CodeRunner.getEndpoint();
    const { ok, message } = await CodeRunner.testEndpoint(url);
    setTestState(ok ? 'ok' : 'fail');
    setTestMsg(message);
  }, [codeEndpoint]);

  const handleLoadLangs = useCallback(async () => {
    if (showLangs) { setShowLangs(false); return; }
    setLoadingLangs(true);
    const runtimes = await CodeRunner.getRuntimes();
    const unique = new Map<string, string>();
    runtimes.forEach((r: any) => {
      if (!unique.has(r.language)) unique.set(r.language, r.version);
    });
    setRuntimes(Array.from(unique.entries()).map(([language, version]) => ({ language, version })));
    setLoadingLangs(false);
    setShowLangs(true);
  }, [showLangs]);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="flex items-center gap-2">
        <Play size={14} style={{ color: '#10b981' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Code Execution
        </span>
      </div>
      <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        Default: Piston API (stateless, 40+ languages). Set a custom endpoint for a persistent sandbox.
      </p>
      <div className="flex gap-2">
        <input
          className="gia-input"
          style={{ fontSize: '11px', flex: 1 }}
          value={codeEndpoint}
          onChange={e => setCodeEndpoint(e.target.value)}
          placeholder="https://your-server.com/api/v2/piston/execute"
        />
        <button
          onClick={() => {
            if (codeEndpoint.trim()) {
              localStorage.setItem('gia-piston-endpoint', codeEndpoint.trim());
              CodeRunner.setEndpoint(codeEndpoint.trim());
              useGiaStore.getState().addNotification('Code endpoint saved');
            } else {
              localStorage.removeItem('gia-piston-endpoint');
              CodeRunner.setEndpoint('');
              useGiaStore.getState().addNotification('Reset to default Piston API');
            }
          }}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <Save size={11} /> Save
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={handleTest} className="gia-btn text-[10px] px-2.5 py-1.5" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', flex: 1 }}>
          {testState === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleLoadLangs} className="gia-btn text-[10px] px-2.5 py-1.5" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7', flex: 1 }}>
          {loadingLangs ? 'Loading...' : showLangs ? 'Hide Languages' : 'Show Languages'}
        </button>
      </div>
      {testState !== 'idle' && (
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: testState === 'ok' ? '#34d399' : '#f87171' }}>
          {testState === 'ok' ? <Check size={11} /> : <X size={11} />}
          {testMsg || (testState === 'ok' ? 'Connected' : 'Failed')}
        </div>
      )}
      {showLangs && (
        <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1">
          {runtimes.map(r => (
            <span key={r.language} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: '#c084fc' }}>
              {r.language} {r.version}
            </span>
          ))}
        </div>
      )}
      <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
        {codeEndpoint ? `Custom: ${codeEndpoint}` : 'Default: emkc.org Piston API'}
      </p>
    </div>
  );
};

import TTSService from '../services/TTSService';
import BiometricService from '../services/BiometricService';

const VoiceSection: React.FC = () => {
  const [wakeWord, setWakeWord] = useState(() => localStorage.getItem('gia-wake-word') || 'hey gia');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem('gia-keep-listening') !== 'false');
  const [ttsEnabled, setTtsEnabled] = useState(() => TTSService.isEnabled());

  useEffect(() => {
    localStorage.setItem('gia-wake-word', wakeWord);
    useGiaStore.getState().setWakeWord(wakeWord);
  }, [wakeWord]);

  useEffect(() => {
    localStorage.setItem('gia-keep-listening', String(keepListening));
  }, [keepListening]);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Headphones size={14} style={{ color: '#ec4899' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Voice Control
        </span>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>
          Wake Word
        </label>
        <div className="flex gap-2">
          <input
            className="gia-input"
            value={wakeWord}
            onChange={e => setWakeWord(e.target.value)}
            placeholder="hey gia"
            style={{ fontSize: '12px', flex: 1 }}
          />
        </div>
        <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          Say this phrase to activate voice input. Tap "Listen" in Chat to enable.
        </p>
      </div>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer' }}>
        <div
          onClick={() => setKeepListening(k => !k)}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: keepListening ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: keepListening ? '18px' : '2px', background: keepListening ? '#ec4899' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Stay Listening</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            Keep listening for more wake words after each detection. Off = one-shot.
          </p>
        </div>
      </label>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer' }}>
        <div
          onClick={() => {
            const newVal = !ttsEnabled;
            setTtsEnabled(newVal);
            TTSService.setEnabled(newVal);
          }}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: ttsEnabled ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: ttsEnabled ? '18px' : '2px', background: ttsEnabled ? '#ec4899' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Voice Response (TTS)</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            GIA will read her responses out loud.
          </p>
        </div>
      </label>
    </div>
  );
};

const SecuritySection: React.FC = () => {
  const [lockEnabled, setLockEnabled] = useState(() => BiometricService.isLockEnabled());
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    BiometricService.isAvailable().then(setAvailable);
  }, []);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Lock size={14} style={{ color: '#3b82f6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Security
        </span>
      </div>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer', opacity: available ? 1 : 0.5 }}>
        <div
          onClick={async () => {
            if (!available) return;
            const newVal = !lockEnabled;
            if (newVal) {
              const ok = await BiometricService.verify();
              if (!ok) return;
            }
            setLockEnabled(newVal);
            BiometricService.setLockEnabled(newVal);
          }}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: lockEnabled ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: lockEnabled ? '18px' : '2px', background: lockEnabled ? '#3b82f6' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Biometric Lock</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            {available ? 'Protect GIA with FaceID/Fingerprint on startup.' : 'Biometrics not supported on this device.'}
          </p>
        </div>
      </label>
    </div>
  );
};

const CodeHistorySection: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(() => CodeRunner.getHistory());

  const refresh = () => setHistory(CodeRunner.getHistory());

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => { setExpanded(e => !e); if (!expanded) refresh(); }} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <Code2 size={14} style={{ color: '#10b981' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Code Runs ({history.length})
          </span>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {history.length === 0 ? (
            <p className="text-[11px] text-center py-4" style={{ color: 'var(--gia-muted-2)' }}>No code runs yet.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {history.map(r => (
                <div key={r.id} className="px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>{r.language}</span>
                    <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{new Date(r.ts).toLocaleString()}</span>
                    <span className="text-[9px]" style={{ color: r.exitCode === 0 ? '#34d399' : '#f87171' }}>exit {r.exitCode}</span>
                  </div>
                  <p className="text-[10px] mt-1 truncate font-mono" style={{ color: 'var(--gia-muted)' }}>{r.code.slice(0, 120)}</p>
                  {r.error && <p className="text-[9px] mt-0.5 truncate" style={{ color: '#f87171' }}>✕ {r.error.slice(0, 100)}</p>}
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear all code run history?')) { CodeRunner.clearHistory(); refresh(); } }}
              className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg w-full"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <Trash2 size={10} /> Clear History
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const InstallSection: React.FC = () => {
  const [repo, setRepo] = useState(() => localStorage.getItem('gia-github-repo') || 'alpha-1-design/gia-app');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState(false);
  const [saved, setSaved] = useState(false);

  const releaseUrl = repo ? `https://github.com/${repo}/releases/latest` : '';

  useEffect(() => {
    if (!repo || !canvasRef.current) return;
    setQrError(false);
    QRCode.toCanvas(canvasRef.current, releaseUrl, {
      width: 160, margin: 2, color: { dark: '#ffffff', light: '#0a0a0f' },
    }).catch(() => setQrError(true));
  }, [repo, releaseUrl]);

  const handleSave = () => {
    localStorage.setItem('gia-github-repo', repo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Smartphone size={14} style={{ color: '#3b82f6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Install GIA
        </span>
      </div>

      <div className="flex justify-center py-2">
        {qrError || !repo ? (
          <div className="w-40 h-40 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-center px-4" style={{ color: 'var(--gia-muted-2)' }}>
              {!repo ? 'Set your GitHub repo below' : 'Could not generate QR'}
            </p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="rounded-xl" style={{ border: '2px solid rgba(255,255,255,0.08)' }} />
        )}
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--gia-muted-2)' }}>
        Scan with your phone to download the latest APK
      </p>

      <div className="flex gap-2">
        <input
          className="gia-input"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          placeholder="owner/gia-app"
          style={{ fontSize: '11px', flex: 1 }}
        />
        <button
          onClick={handleSave}
          className="gia-btn text-xs px-3 py-2"
          style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)', border: `1px solid ${saved ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.2)'}`, color: saved ? '#34d399' : '#3b82f6' }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {releaseUrl && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gia-btn flex items-center justify-center gap-1.5 text-[11px] px-3 py-2 w-full"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
        >
          <ExternalLink size={11} /> Open Latest Release
        </a>
      )}

      <div className="flex flex-col gap-1 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
        <div className="flex items-center gap-1.5">
          <Mail size={10} /> alphariansamuel@gmail.com
        </div>
        <div className="flex items-center gap-1.5">
          <Globe size={10} /> alpha1-studio.vercel.app
        </div>
      </div>
    </div>
  );
};

export default SettingsModule;
