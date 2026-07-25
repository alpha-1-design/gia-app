import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Trash2, Smartphone, Globe } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { useGiaStore } from '../../store/useGiaStore';
import { isNativePlatform } from '../../utils/helpers';
import AnalyticsService from '../../services/AnalyticsService';
import ConfirmDialog from '../ConfirmDialog';

export const AboutPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [confirmChats, setConfirmChats] = useState(false);
  const dangerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (dangerTimerRef.current) clearTimeout(dangerTimerRef.current); }; }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '16px' }}>
      <SubPageHeader title="About" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: '#94a3b8' }}>About this panel</p>
        <p className="mb-2">App-level info, usage tracking, version details, and actions that permanently delete data. Read carefully before using anything here.</p>
        <ul className="space-y-1.5 pl-3" style={{ listStyle: 'disc' }}>
          <li><strong style={{ color: '#94a3b8' }}>Usage Analytics</strong> — Toggle local-only analytics tracking. When enabled, GIA tracks which features you use (number of chats, tool calls, modules visited). <strong>All data stays on your device</strong> — nothing is sent anywhere. Used purely to help improve your experience.</li>
          <li><strong style={{ color: '#94a3b8' }}>Danger Zone</strong> — <span style={{ color: '#f87171' }}>Clear All Chats</span> permanently deletes every conversation. This is irreversible. Your profile, identity, skills, and plugins are preserved — only chat history is removed.</li>
          <li><strong style={{ color: '#94a3b8' }}>Platform Info</strong> — Shows whether you're on web or native (Android/iOS), the Capacitor version, and which device features are available (Files, Voice, Biometrics, etc.).</li>
        </ul>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
          Tip: Analytics is completely optional and local-only. If you're troubleshooting, you can clear chats here as a last resort — but try archiving or searching first. The version info is handy when reporting bugs.
        </p>
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

      {/* Danger Zone */}
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

      {/* GIA Everywhere vision */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: '#c4b5fd' }}>🌌 GIA Everywhere</p>
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--gia-muted)' }}>
          GIA started as an app. It's about to stop being just an app. <strong style={{ color: '#a78bfa' }}>GIA Desktop is coming</strong> — same brain, bigger canvas, and they sync: phone to desktop, desktop to phone. Your memory, your agents, your context, following you like they always should.
        </p>
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--gia-muted)' }}>Not stopping at two screens:</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {['GIA CLI', 'GIA Watch', 'GIA Car', 'GIA Phone', 'GIA Everything'].map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)' }}>{t}</span>
          ))}
        </div>
        <p className="text-[10px] italic" style={{ color: 'var(--gia-muted-2)' }}>
          They've not seen this one before. They won't see this one coming. GIA isn't a chatbot — it's the start of something packed, powerful, and everywhere.
        </p>
      </div>

      {/* Version */}
      <p className="text-center text-[10px] pb-4" style={{ color: 'var(--gia-muted-2)' }}>
        GIA v2.3.3.0-beta.1 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
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
