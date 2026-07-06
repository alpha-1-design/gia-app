import React, { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'motion/react';
import {
  Terminal, User, Save, ChevronRight,
  Zap, Smartphone, Sun, Moon,
  UserCircle, PlugZap, Battery, Cpu,   Puzzle, Info,
  Network, Bot, Activity, Download, CheckCircle, XCircle, Shield,
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { isNativePlatform } from '../utils/helpers';
import { updateService, formatSize } from '../services/UpdateService';
import type { UpdateInfo, DownloadProgress } from '../services/UpdateService';
import MCPSettings from '../components/MCPSettings';
import ConfirmDialog from '../components/ConfirmDialog';
import { ProfileIdentityPage } from '../components/settings/ProfileIdentityPage';
import { ConnectionsPage } from '../components/settings/ConnectionsPage';
import { SystemPage } from '../components/settings/SystemPage';
import { LocalAIPage } from '../components/settings/LocalAIPage';
import { AppExtensionsPage } from '../components/settings/AppExtensionsPage';
import { AboutPage } from '../components/settings/AboutPage';
import { NeuraPage } from '../components/settings/NeuraPage';
import { NexusPage } from '../components/settings/NexusPage';
import { MicalPage } from '../components/settings/MicalPage';
import { DashboardModule } from './DashboardModule';
import { providerRegistry } from '../services/ProviderRegistry';
import { getProviderCapabilities, CAPABILITY_LABELS } from '../services/providers/capabilities';
import type { ProviderCapabilities } from '../services/providers/capabilities';

type SettingsPage = 'main' | 'profile-identity' | 'connections' | 'system' | 'local-ai' | 'app-extensions' | 'about' | 'dashboard' | 'neura' | 'nexus' | 'mical';

const CATEGORIES: { id: SettingsPage; icon: React.ReactNode; label: string; desc: string; sections: string; color: string }[] = [
  { id: 'profile-identity', icon: <UserCircle size={20} />, label: 'Profile & Identity', desc: 'Your profile, GIA identity, skills, memory & brain export', sections: '5 sections', color: '#a855f7' },
  { id: 'connections', icon: <PlugZap size={20} />, label: 'Connections', desc: 'API connectors, social media, gateway, browser & search', sections: '5 sections', color: '#f59e0b' },
  { id: 'system', icon: <Battery size={20} />, label: 'System & Performance', desc: 'Security, code execution, voice, power & reliability', sections: '7 sections', color: '#34d399' },
  { id: 'local-ai', icon: <Cpu size={20} />, label: 'Local AI', desc: 'On-device LLM models & vision recognition', sections: '2 sections', color: '#22c55e' },
  { id: 'app-extensions', icon: <Puzzle size={20} />, label: 'App & Extensions', desc: 'Plugins, install APK, code history & developer settings', sections: '5 sections', color: '#a855f7' },
  { id: 'dashboard', icon: <Activity size={20} />, label: 'Dashboard', desc: 'Performance analytics, tool usage, error tracking & insights', sections: '6 sections', color: '#3b82f6' },
  { id: 'about', icon: <Info size={20} />, label: 'About', desc: 'Analytics, version info & danger zone', sections: '3 sections', color: '#94a3b8' },
];

const SettingsModule: React.FC = () => {
  const {
    setShowTerminal, userProfile, setUserProfile,
    theme, setTheme,
  } = useGiaStore(useShallow(s => ({
    setShowTerminal: s.setShowTerminal, userProfile: s.userProfile, setUserProfile: s.setUserProfile,
    addNotification: s.addNotification, theme: s.theme, setTheme: s.setTheme,
  })));
  const providers = useProviderStore(s => s.providers);

  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const [editProfile, setEditProfile] = useState(false);
  const [name, setProfileName] = useState(userProfile.name);
  const [bio, setBio] = useState(userProfile.bio);
  const [goals, setGoals] = useState(userProfile.goals);
  const [confirmChats, setConfirmChats] = useState(false);
  const dangerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current); }; }, []);

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateState, setUpdateState] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (settingsPage !== 'main') return;
    updateService.checkForUpdate().then(info => {
      if (info) setUpdateInfo(info);
    });
  }, [settingsPage]);

  const handleDownload = async () => {
    if (!updateInfo) return;
    setUpdateState('downloading');
    setDownloadProgress(0);
    try {
      await updateService.downloadUpdate(updateInfo.downloadUrl, (p: DownloadProgress) => {
        setDownloadProgress(p.percent);
      });
      setUpdateState('ready');
    } catch (e) {
      setUpdateState('error');
      setUpdateError((e as Error).message);
    }
  };

  const handleInstall = async () => {
    try {
      await updateService.installUpdate();
    } catch (e) {
      setUpdateState('error');
      setUpdateError((e as Error).message);
    }
  };

  const saveProfile = () => {
    setUserProfile({ name: name.trim(), bio: bio.trim(), goals: goals.trim() });
    setEditProfile(false);
  };

  const connectedCount = Object.keys(providers).filter(p => providers[p]?.enabled).length;

  // ── Sub-page routing ──────────────────────────────────────────────
  if (settingsPage === 'profile-identity') return <ProfileIdentityPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'connections') return <ConnectionsPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'system') return <SystemPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'local-ai') return <LocalAIPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'app-extensions') return <AppExtensionsPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'about') return <AboutPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'dashboard') return <DashboardModule onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'neura') return <NeuraPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'nexus') return <NexusPage onBack={() => setSettingsPage('main')} />;
  if (settingsPage === 'mical') return <MicalPage onBack={() => setSettingsPage('main')} />;

  // ── Main page ────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}
    >
      {/* Profile (compact) */}
      <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={14} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
              Your Profile
            </span>
          </div>
          <button onClick={() => setEditProfile(e => !e)}
            className="text-[11px] font-medium" style={{ color: '#a855f7' }}>
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
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input className="gia-input" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
            <button onClick={saveProfile} className="gia-btn gia-btn-primary w-full mt-1"><Save size={13} /> Save Profile</button>
          </div>
        ) : (
          <div>
            {userProfile.name ? (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{userProfile.name}</p>
                {userProfile.bio && <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>{userProfile.bio}</p>}
                {userProfile.goals && <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: '#a855f7' }}>✦ {userProfile.goals}</p>}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>No profile set — add your name so GIA can personalise responses.</p>
            )}
          </div>
        )}
      </div>

      {/* Update Banner */}
      {updateInfo && (
        <div className="gia-card p-4" style={{ borderColor: 'rgba(52,211,153,0.3)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)' }}>
              {updateState === 'ready' ? <CheckCircle size={18} style={{ color: '#34d399' }} /> :
               updateState === 'error' ? <XCircle size={18} style={{ color: '#f87171' }} /> :
               <Download size={18} style={{ color: '#34d399' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
                {updateState === 'ready' ? 'Download Complete' :
                 updateState === 'error' ? 'Download Failed' :
                 `Update Available: v${updateInfo.version}`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>
                {updateState === 'ready' ? (
                  <>Tap Install to upgrade now · {formatSize(updateInfo.size)}</>
                ) :
                 updateState === 'error' ? updateError :
                 `Current: v${updateInfo.currentVersion} · ${updateInfo.releaseName} · ${formatSize(updateInfo.size)}`}
              </p>
            </div>
            {updateState === 'downloading' ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, rgba(52,211,153,0.1), rgba(16,185,129,0.2))', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <motion.div 
                    className="h-full rounded-full transition-all"
                    style={{ width: `${downloadProgress}%`, background: 'linear-gradient(90deg, #34d399, #10b981)' }}
                    animate={{ background: ['linear-gradient(90deg, #34d399, #10b981)', 'linear-gradient(90deg, #10b981, #34d399)'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatType: 'loop', ease: 'linear' }}
                  />
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: '#34d399' }}>{downloadProgress}%</span>
              </div>
            ) : updateState === 'ready' ? (
              <button onClick={handleInstall}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                Install
              </button>
            ) : updateState === 'error' ? (
              <button onClick={handleDownload}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                Retry
              </button>
            ) : (
              <button onClick={handleDownload}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                Download
              </button>
            )}
          </div>
        </div>
      )}

      {/* Setup Guide (Android) */}
      {isNativePlatform() && (
        <div className="gia-card p-4" style={{ borderColor: 'rgba(168,85,247,0.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={14} style={{ color: '#a855f7' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
              Setup GIA as Personal Assistant
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { num: '1', title: 'Default Assistant', desc: 'Settings → Apps → Default apps → Digital assistant app → pick GIA', note: 'Long-press home button anywhere to launch GIA', color: '#a855f7' },
              { num: '2', title: 'Accessibility Service', desc: 'Settings → Accessibility → GIA Circle-to-Search → enable', note: 'Grants screen reading, screenshots & gesture control', color: '#3b82f6' },
              { num: '3', title: 'Overlay Permission', desc: 'Settings → Apps → GIA → Display over other apps → enable', note: 'Required for floating UI elements', color: '#f59e0b' },
            ].map(step => (
              <div key={step.num} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                  style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}>
                  {step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{step.title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{step.desc}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: step.color, opacity: 0.7 }}>↳ {step.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engine Room (untouched) */}
      <button
        onClick={() => setShowTerminal(true)}
        className="gia-card p-4 flex items-center gap-4 w-full text-left tap-feedback"
        style={{ transition: 'border-color 0.2s' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#0d0d14', border: '1px solid rgba(16,185,129,0.2)' }}>
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
      <div className="gia-card p-4"><MCPSettings /></div>

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
                  <th key={key} className="px-2 py-2 text-center font-medium" style={{ color: 'var(--gia-muted)' }} title={cap.label}>{cap.icon}</th>
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
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--gia-text)' }}>{providerRegistry.getLabel(id)}</td>
                    {(Object.keys(CAPABILITY_LABELS) as Array<keyof ProviderCapabilities>).map(key => (
                      <td key={key} className="px-2 py-2 text-center">
                        {caps[key] ? <span className="text-green-400">✓</span> : <span className="opacity-20">—</span>}
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
              {theme === 'light' ? <Sun size={18} style={{ color: '#a855f7' }} /> : <Moon size={18} style={{ color: '#a855f7' }} />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Theme</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>{theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System default'}</p>
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
                }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Category grid */}
      <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--gia-muted)' }}>
        All Settings
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSettingsPage(cat.id)}
            className="gia-card p-4 flex items-start gap-4 w-full text-left tap-feedback"
            style={{ transition: 'border-color 0.2s' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#0d0d14', border: `1px solid ${cat.color}30` }}>
              <span style={{ color: cat.color }}>{cat.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>{cat.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>{cat.desc}</p>
              <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: `${cat.color}15`, color: cat.color }}>
                {cat.sections}
              </span>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--gia-muted)', flexShrink: 0, marginTop: 4 }} />
          </button>
        ))}
      </div>

      {/* Neura + Nexus cards */}
      <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--gia-muted)' }}>
        Intelligence
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => setSettingsPage('neura')}
          className="gia-card p-4 flex items-start gap-4 w-full text-left tap-feedback"
          style={{ transition: 'border-color 0.2s' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#0d0d14', border: '1px solid #a855f730' }}>
            <Network size={20} style={{ color: '#a855f7' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Neura</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>Knowledge graph, search & indexed intelligence</p>
            <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: '#a855f715', color: '#a855f7' }}>
              Graph · Search · Sources
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--gia-muted)', flexShrink: 0, marginTop: 4 }} />
        </button>
        <button onClick={() => setSettingsPage('nexus')}
          className="gia-card p-4 flex items-start gap-4 w-full text-left tap-feedback"
          style={{ transition: 'border-color 0.2s' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#0d0d14', border: '1px solid #10b98130' }}>
            <Bot size={20} style={{ color: '#10b981' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Nexus</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>Sub-agent command center & tuning</p>
            <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: '#10b98115', color: '#10b981' }}>
              Agents · Stats · Tuning
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--gia-muted)', flexShrink: 0, marginTop: 4 }} />
        </button>
      </div>

      {/* Mical card */}
      <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--gia-muted)' }}>
        Mical
      </p>
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => setSettingsPage('mical')}
          className="gia-card p-4 flex items-start gap-4 w-full text-left tap-feedback"
          style={{ transition: 'border-color 0.2s' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#0d0d14', border: '1px solid #ef444430' }}>
            <Shield size={20} style={{ color: '#ef4444' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Mical</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gia-muted)' }}>Live scan, ports, firewall, threat lookup & IP trace</p>
            <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>
              Scan · Firewall · Threat
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'var(--gia-muted)', flexShrink: 0, marginTop: 4 }} />
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] pb-4 pt-2" style={{ color: 'var(--gia-muted-2)' }}>
        GIA v2.3.2.0 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
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
