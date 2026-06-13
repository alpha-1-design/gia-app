import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Shield, User, Save, ChevronRight,
  Trash2, Zap, Sparkles, Download, Smartphone, Globe, Sun, Moon, BarChart3
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import { useGiaIdentity } from '../store/useGiaIdentity';
import { useProviderStore } from '../store/useProviderStore';
import { isNativePlatform } from '../utils/helpers';
import MCPSettings from '../components/MCPSettings';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkillsSubPage } from '../components/settings/SkillsSubPage';
import { IdentitySubPage } from '../components/settings/IdentitySubPage';
import { BrainExportSubPage } from '../components/settings/BrainExportSubPage';
import { MemorySection } from '../components/settings/MemorySection';
import { CodeExecutionSection } from '../components/settings/CodeExecutionSection';
import { VoiceSection } from '../components/settings/VoiceSection';
import { SecuritySection } from '../components/settings/SecuritySection';
import { PluginSection } from '../components/settings/PluginSection';
import { PluginInstallSection } from '../components/settings/PluginInstallSection';
import { CodeHistorySection } from '../components/settings/CodeHistorySection';
import { InstallSection } from '../components/settings/InstallSection';
import { BrowserSection } from '../components/settings/BrowserSection';
import { SearchSection } from '../components/settings/SearchSection';
import { ReliabilitySection } from '../components/settings/ReliabilitySection';
import { VisionSection } from '../components/settings/VisionSection';
import { LocalModelsSection } from '../components/settings/LocalModelsSection';
import { DeveloperSettings } from '../components/settings/DeveloperSettings';
import { ConnectorsSection } from '../components/settings/ConnectorsSection';
import { SocialSection } from '../components/settings/SocialSection';
import { GatewaySection } from '../components/settings/GatewaySection';
import { providerRegistry } from '../services/ProviderRegistry';
import { getProviderCapabilities, CAPABILITY_LABELS } from '../services/providers/capabilities';
import type { ProviderCapabilities } from '../services/providers/capabilities';
import AnalyticsService from '../services/AnalyticsService';

const SettingsModule: React.FC = () => {
  const { 
    setShowTerminal, userProfile, setUserProfile, skills, addNotification,
    theme, setTheme,
  } = useGiaStore();
  const identity = useGiaIdentity(s => s.identity);
  const { providers } = useProviderStore();

  const [settingsPage, setSettingsPage] = useState<'main' | 'skills' | 'identity' | 'brain-export'>('main');
  const [editProfile, setEditProfile] = useState(false);
  const [name, setProfileName] = useState(userProfile.name);
  const [bio, setBio] = useState(userProfile.bio);
  const [goals, setGoals] = useState(userProfile.goals);
  const [codeEndpoint, setCodeEndpoint] = useState(() => localStorage.getItem('gia-piston-endpoint') || '');
  const [confirmChats, setConfirmChats] = useState(false);
  const dangerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current); }; }, []);

  const saveProfile = () => {
    setUserProfile({ name: name.trim(), bio: bio.trim(), goals: goals.trim() });
    setEditProfile(false);
  };

  const connectedCount = Object.keys(providers).filter(p => providers[p]?.enabled).length;

  if (settingsPage === 'skills') {
    return <SkillsSubPage onBack={() => setSettingsPage('main')} />;
  }
  if (settingsPage === 'identity') {
    return <IdentitySubPage onBack={() => setSettingsPage('main')} />;
  }
  if (settingsPage === 'brain-export') {
    return <BrainExportSubPage onBack={() => setSettingsPage('main')} />;
  }

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
              { label: 'Your name', val: name, set: setProfileName, placeholder: 'e.g. Samuel' },
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
            {connectedCount}/{providerRegistry.getAllIds().length}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
        </div>
      </button>

      {/* MCP Servers */}
      <div className="gia-card p-4">
        <MCPSettings />
      </div>

      {/* Provider Capability Matrix */}
      <div className="gia-card p-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--gia-text)' }}>
          <Zap size={14} className="inline mr-2" style={{ color: '#f59e0b' }} />
          Provider Capabilities
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--gia-muted)' }}>Provider</th>
                {Object.entries(CAPABILITY_LABELS).map(([key, cap]) => (
                  <th key={key} className="px-2 py-2 text-center font-medium" style={{ color: 'var(--gia-muted)' }} title={cap.label}>
                    {cap.icon}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providerRegistry.getAllIds().map(id => {
                const p = providers[id];
                const model = p?.model || providerRegistry.getDefaultModel(id);
                const listingType = providerRegistry.getListingType(id);
                const caps = getProviderCapabilities(listingType, model);
                return (
                  <tr key={id} className="border-t" style={{ borderColor: 'var(--gia-border)' }}>
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--gia-text)' }}>
                      {providerRegistry.getLabel(id)}
                    </td>
                    {(Object.keys(CAPABILITY_LABELS) as Array<keyof ProviderCapabilities>).map(key => (
                      <td key={key} className="px-2 py-2 text-center">
                        {caps[key] ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="opacity-20">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] mt-2" style={{ color: 'var(--gia-muted)' }}>
          Based on provider type and selected model. Update model in Engine Room for accurate results.
        </p>
      </div>

      {/* Theme */}
      <div className="gia-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
              {theme === 'light' ? <Sun size={18} style={{ color: '#a855f7' }} /> : <Moon size={18} style={{ color: '#a855f7' }} />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Theme</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System default'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {(['dark', 'light', 'system'] as const).map(t => (
              <button key={t} onClick={() => setTheme(t)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize"
                style={{
                  background: theme === t ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                  color: theme === t ? '#a855f7' : 'var(--gia-muted)',
                  border: `1px solid ${theme === t ? 'rgba(168,85,247,0.25)' : 'transparent'}`,
                }}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation to sub-pages */}
      <button onClick={() => setSettingsPage('skills')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#0d0d14', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Zap size={18} style={{ color: '#f59e0b' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Neural Skills</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            {skills.length} active · {skills.filter(s => s.category === 'user').length} custom
          </p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

      <button onClick={() => setSettingsPage('identity')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#0d0d14', border: '1px solid rgba(168,85,247,0.2)' }}>
          <Sparkles size={18} style={{ color: '#a855f7' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>GIA Identity</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            {identity.name} · {identity.personalityStyle} · {identity.tone} tone
          </p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

      <button onClick={() => setSettingsPage('brain-export')}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#0d0d14', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Download size={18} style={{ color: '#34d399' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Brain Export</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
            Backup or restore GIA memories and identity
          </p>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />
      </button>

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
              addNotification('Open system settings and enable "Display over other apps" for GIA.');
            }}
            className="gia-btn mt-3 text-[10px] px-3 py-1.5 border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
          >
            Grant Overlay Permission
          </button>
        </div>
      </div>

      <VoiceSection />
      <LocalModelsSection />
      <VisionSection />
      <SecuritySection />
      <CodeExecutionSection codeEndpoint={codeEndpoint} setCodeEndpoint={setCodeEndpoint} />
      <ConnectorsSection />
      <SocialSection />
      <GatewaySection />
      <BrowserSection />
      <SearchSection />
      <CodeHistorySection />
      <ReliabilitySection />
      <PluginSection />
      <PluginInstallSection />
      <InstallSection />
      <DeveloperSettings />

      {/* Danger zone */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#f87171' }}>Danger Zone</p>
        <button
          onClick={() => setConfirmChats(true)}
          className="gia-btn flex items-center gap-2 w-full"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
        >
          <Trash2 size={13} /> Clear All Chats
        </button>
      </div>

      {/* Platform */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
          <Smartphone size={11} />
          <span>{isNativePlatform() ? 'Android/iOS' : 'Web Browser'}</span>
          <span className="mx-1">·</span>
          <Globe size={11} />
          <span>Capacitor 8</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {[
            { label: 'Files', available: isNativePlatform() },
            { label: 'Voice', available: isNativePlatform() },
            { label: 'Biometrics', available: isNativePlatform() },
            { label: 'TTS', available: true },
            { label: 'Code Run', available: true },
            { label: 'Notifications', available: isNativePlatform() },
          ].map(f => (
            <span key={f.label} className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{
              background: f.available ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
              color: f.available ? '#34d399' : '#f59e0b',
              border: `1px solid ${f.available ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
            }}>
              {f.label} {f.available ? '✓' : '~'}
            </span>
          ))}
        </div>
      </div>

      {/* Analytics */}
      <div className="gia-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0d0d14', border: '1px solid rgba(139,92,246,0.2)' }}>
              <BarChart3 size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Usage Analytics</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
                {AnalyticsService.isOptedIn() ? 'Local-only, no data leaves device' : 'Opt in to track usage locally'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const v = !AnalyticsService.isOptedIn();
              AnalyticsService.setOptIn(v);
              useGiaStore.getState().addNotification(v ? 'Analytics enabled (local only)' : 'Analytics disabled');
            }}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{
              background: AnalyticsService.isOptedIn() ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${AnalyticsService.isOptedIn() ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.15)'}`,
            }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
              style={{
                background: AnalyticsService.isOptedIn() ? '#a78bfa' : '#6b7280',
                transform: AnalyticsService.isOptedIn() ? 'translateX(22px)' : 'translateX(2px)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] pb-4" style={{ color: 'var(--gia-muted-2)' }}>
        GIA v2.3.1.2 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
      </p>

      <ConfirmDialog
        open={confirmChats}
        title="Clear All Chats?"
        message="This will permanently delete all conversations. This cannot be undone."
        confirmLabel="Clear All"
        danger
        onConfirm={() => {
          useGiaStore.setState({ sessions: [], activeSessionId: null });
          dangerTimerRef.current = setTimeout(() => useGiaStore.getState().createSession(), 0);
          setConfirmChats(false);
        }}
        onCancel={() => setConfirmChats(false)}
      />
    </div>
  );
};

export default SettingsModule;
