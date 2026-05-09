import React, { useState } from 'react';
import {
  Terminal, Shield, User, Bell, X, Save, ChevronRight,
  Wifi, WifiOff, Cpu, Trash2,
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore, PROVIDER_DEFAULTS, ProviderType } from '../store/useProviderStore';

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
        GIA v2.2.0 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
      </p>
    </div>
  );
};

export default SettingsModule;
