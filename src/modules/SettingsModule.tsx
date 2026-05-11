import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Terminal, Shield, User, X, Save, ChevronRight,
  Wifi, WifiOff, Cpu, Trash2, Brain, Search, Play, Check,
  Code2, Headphones, Smartphone, ExternalLink, Mail, Globe,
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
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
  const { setShowTerminal, userProfile, setUserProfile, notifications, clearNotification } = useGiaStore();
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
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--gia-border)')}
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

      {/* Connected providers summary */}
      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="flex items-center gap-2">
          <Cpu size={14} style={{ color: '#3b82f6' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Providers
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ALL_PROVIDERS.map(p => {
            const cfg = providers[p];
            const def = PROVIDER_DEFAULTS[p];
            const isActive = activeProvider === p;
            const color = PROVIDER_COLORS[p];
            return (
              <div key={p} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}20` }}
                >
                  {cfg.enabled
                    ? <Wifi size={11} style={{ color }} />
                    : <WifiOff size={11} style={{ color: 'var(--gia-muted-2)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: cfg.enabled ? 'var(--gia-text)' : 'var(--gia-muted)' }}>
                    {def.label}
                  </p>
                  {cfg.enabled && (
                    <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted-2)' }}>{cfg.model}</p>
                  )}
                </div>
                {isActive && cfg.enabled && (
                  <span className="gia-pill gia-pill-accent" style={{ fontSize: '8px', padding: '1px 6px' }}>Active</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          Open Engine Room to add/remove providers.
        </p>
      </div>

      {/* Memory */}
      <MemorySection />

      {/* Privacy */}
      <div className="gia-card p-4 flex items-start gap-3">
        <Shield size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Privacy First</p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
            GIA runs entirely on-device. No backend, no data collection.
            Your chats are stored locally in IndexedDB — encrypted at rest
            by your device. API keys never leave your device.
          </p>
        </div>
      </div>

      {/* Voice */}
      <VoiceSection />

      {/* Code Execution */}
      <CodeExecutionSection codeEndpoint={codeEndpoint} setCodeEndpoint={setCodeEndpoint} />

      {/* Code History */}
      <CodeHistorySection />

      {/* Install GIA */}
      <InstallSection />

      {/* Danger zone */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#f87171' }}>Danger Zone</p>
        <button
          onClick={() => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
              useGiaStore.setState({ sessions: [], activeSessionId: null });
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
        GIA v2.2.2.0 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
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

const VoiceSection: React.FC = () => {
  const [wakeWord, setWakeWord] = useState(() => localStorage.getItem('gia-wake-word') || 'hey gia');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem('gia-keep-listening') !== 'false');

  useEffect(() => {
    localStorage.setItem('gia-wake-word', wakeWord);
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
