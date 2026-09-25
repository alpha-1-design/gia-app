import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Trash2, Smartphone, Globe, History, MessageSquare, Send, ExternalLink } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import { useGiaStore } from '../../store/useGiaStore';
import { isNativePlatform } from '../../utils/helpers';
import AnalyticsService from '../../services/AnalyticsService';
import ConfirmDialog from '../ConfirmDialog';
import ChangelogModal from '../ChangelogModal';

const FEEDBACK_EMAIL = 'alphariansamuel@gmail.com';

export const AboutPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [confirmChats, setConfirmChats] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('Bug report');
  const [feedbackText, setFeedbackText] = useState('');
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

      {/* Phone design preview */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'linear-gradient(160deg, rgba(34,211,238,0.06), rgba(139,92,246,0.08))' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: '#a5f3fc' }}>The GIA phone experience</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>A calm command center for your device, not another noisy chatbot.</p>
          </div>
          <Smartphone size={18} style={{ color: '#67e8f9' }} />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-[142px] shrink-0 rounded-[24px] p-1.5 shadow-xl" style={{ background: '#090b14', border: '1px solid rgba(165,243,252,0.35)', boxShadow: '0 12px 32px rgba(34,211,238,0.12)' }}>
            <div className="rounded-[19px] overflow-hidden p-2.5" style={{ minHeight: 220, background: 'linear-gradient(180deg, #111827, #080a12)' }}>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[8px] font-bold tracking-[0.18em] text-cyan-200">GIA</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'radial-gradient(circle at 35% 30%, #67e8f9, #8b5cf6 52%, #111827 72%)', boxShadow: '0 0 24px rgba(139,92,246,0.55)' }}>
                <span className="text-[10px] font-bold text-white">ASK</span>
              </div>
              <div className="rounded-xl px-2.5 py-2 mb-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <p className="text-[8px] leading-relaxed text-zinc-300">Ready when you are. I can use your phone, files, and connected services—with your approval.</p>
              </div>
              <div className="flex gap-1.5">
                {['Talk', 'Scan', 'Act'].map(action => <span key={action} className="flex-1 text-center rounded-md py-1 text-[7px] text-cyan-100" style={{ background: 'rgba(34,211,238,0.12)' }}>{action}</span>)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1 w-full">
            {[
              ['Orb assistant', 'Talk, see, and act from anywhere on the phone.'],
              ['Permission-first', 'GIA pauses and asks before sensitive actions.'],
              ['Secure connections', 'API keys and service tokens stay in the vault.'],
              ['Sandbox + Termux', 'Build, inspect, and automate with explicit control.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--gia-text)' }}>{title}</p>
                <p className="text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>{description}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-center" style={{ color: 'var(--gia-muted-2)' }}>
          This preview represents the direction: a floating orb, fast actions, visible capability state, and a clear pause whenever GIA needs your permission.
        </p>
      </div>

      {/* Version + changelog */}
      <div className="gia-card p-4" style={{ borderColor: 'rgba(34,211,238,0.2)' }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,211,238,0.1)', color: '#67e8f9' }}>
            <MessageSquare size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Report a problem or send feedback</p>
            <p className="text-[10px] leading-relaxed mt-1" style={{ color: 'var(--gia-muted-2)' }}>
              Tell Samuel what went wrong or what GIA should improve. The app opens your email client; nothing is sent automatically.
            </p>
          </div>
        </div>
        {feedbackOpen ? (
          <div className="mt-4 space-y-3">
            <select
              value={feedbackType}
              onChange={e => setFeedbackType(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-xs"
              style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
            >
              <option>Bug report</option>
              <option>Complaint</option>
              <option>Feature request</option>
              <option>Privacy or security concern</option>
            </select>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Describe what happened, what you expected, and how to reproduce it..."
              rows={4}
              className="w-full rounded-xl px-3 py-2 text-xs resize-none"
              style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
            />
            <div className="flex gap-2">
              <button
                disabled={!feedbackText.trim()}
                onClick={() => {
                  const subject = `[GIA ${feedbackType}] v2.4.0.11`;
                  const body = `${feedbackText.trim()}\n\n---\nGIA version: 2.4.0.11\nPlatform: ${isNativePlatform() ? 'Android/iOS' : 'Web Browser'}`;
                  window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-40"
                style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', color: '#67e8f9' }}
              >
                <Send size={13} /> Open email
              </button>
              <button onClick={() => setFeedbackOpen(false)} className="px-3 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gia-muted)' }}>
                Cancel
              </button>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Feedback goes to {FEEDBACK_EMAIL} only after you review and send it.</p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setFeedbackOpen(true)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: '#67e8f9' }}>
              <MessageSquare size={13} /> Write feedback
            </button>
            <a href="https://github.com/alpha-1-design/gia-app/issues/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}>
              <ExternalLink size={12} /> GitHub issue
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pb-4">
        <button
          onClick={() => setShowChangelog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', color: '#a78bfa' }}
        >
          <History size={13} />
          <span className="text-xs font-semibold">View Changelog</span>
        </button>
        <p className="text-center text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
          GIA v2.4.0.11 · Built by Samuel Mensah · Alpha-1 Studio, Ghana
        </p>
      </div>

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

      <ChangelogModal open={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
};
