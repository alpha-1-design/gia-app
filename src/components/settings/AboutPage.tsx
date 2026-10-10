import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Trash2, Smartphone, Globe, History, MessageSquare, Send, ExternalLink, ShieldCheck, Mic, ScanLine, Sparkles, Plus, ArrowUp } from 'lucide-react';
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
      <div className="gia-card relative isolate shrink-0 overflow-hidden p-4 sm:p-5" style={{ borderColor: 'rgba(139,92,246,0.24)', background: 'radial-gradient(ellipse at 50% 34%, rgba(99,102,241,0.13), transparent 52%), linear-gradient(155deg, rgba(19,18,35,0.96), rgba(8,10,19,0.98))' }}>
        <div className="absolute -top-24 left-1/2 -z-10 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.15)' }} />
        <div className="mb-5 text-center">
          <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--gia-text)' }}>GIA, in your pocket</p>
          <p className="mx-auto mt-1 max-w-xs text-[10px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>A capable assistant that feels at home on your phone—ready when you are, with you in control.</p>
        </div>

        <div className="mx-auto w-[min(100%,220px)]">
          <div
            role="img"
            aria-label="Concept preview of the GIA mobile app on a phone"
            className="relative rounded-[36px] p-[7px]"
            style={{
              background: 'linear-gradient(145deg, #73718b 0%, #222333 9%, #090a11 34%, #29283a 70%, #77718e 100%)',
              border: '1px solid rgba(226,232,240,0.3)',
              boxShadow: '0 30px 70px -28px rgba(0,0,0,0.95), 0 16px 40px -18px rgba(139,92,246,0.48), inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            <div className="absolute -right-[3px] top-[104px] h-12 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(#78758c,#272633)' }} />
            <div className="absolute -left-[3px] top-[92px] h-8 w-[3px] rounded-l-full" style={{ background: 'linear-gradient(#77748a,#272633)' }} />
            <div className="relative min-h-[382px] overflow-hidden rounded-[30px] px-3.5 pb-3 pt-3" style={{ background: 'radial-gradient(ellipse at 65% 2%, rgba(124,58,237,0.16), transparent 42%), linear-gradient(180deg, #11121c, #090a10 72%)' }}>
              <div className="absolute left-1/2 top-[7px] z-10 h-[17px] w-[68px] -translate-x-1/2 rounded-full border border-white/[0.04] bg-black" />
              <div className="flex h-5 items-center justify-between px-1 text-[8px] font-semibold text-zinc-200">
                <span>9:41</span>
                <div className="flex items-center gap-1 text-zinc-300">
                  <span className="text-[7px]">●●●</span><span>⌁</span><span className="h-2 w-3 rounded-[2px] border border-zinc-400 p-[1px]"><span className="block h-full w-2/3 rounded-[1px] bg-emerald-300" /></span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-400/20 to-indigo-500/10">
                    <Sparkles size={15} className="text-violet-200" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-zinc-100">GIA</p>
                    <p className="text-[8px] text-zinc-500">Your AI workspace</p>
                  </div>
                </div>
                <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  <Plus size={13} />
                </div>
              </div>

              <div className="pt-4">
                <p className="text-[8px] font-medium uppercase tracking-[0.18em] text-violet-300/80">Good morning</p>
                <p className="mt-1 text-[15px] font-semibold tracking-tight text-white">What’s on your mind?</p>
                <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Think it through, make a plan, or get something done.</p>
              </div>

              <div className="relative my-4 overflow-hidden rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/[0.13] via-indigo-500/[0.07] to-cyan-400/[0.04] p-3">
                <div className="absolute -right-5 -top-7 h-24 w-24 rounded-full bg-violet-400/10 blur-2xl" />
                <div className="relative flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200/25 bg-[radial-gradient(circle_at_35%_30%,#c4b5fd,#8b5cf6_55%,#312e81)] shadow-[0_0_22px_rgba(139,92,246,0.38)]">
                    <Sparkles size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-violet-100">Here when you need me</p>
                    <p className="mt-0.5 text-[8px] leading-relaxed text-zinc-400">Voice, vision, and your tools—on your terms.</p>
                  </div>
                </div>
                <div className="relative mt-3 flex gap-1.5">
                  {[
                    { icon: Mic, label: 'Voice' },
                    { icon: ScanLine, label: 'See' },
                    { icon: MessageSquare, label: 'Chat' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 py-1.5 text-[8px] text-zinc-300">
                      <Icon size={10} className="text-violet-300" />{label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-[8px] font-medium text-zinc-500">RECENT CONVERSATIONS</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                  <div className="h-6 w-1 rounded-full bg-violet-400/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-medium text-zinc-200">Plan my week</p>
                    <p className="mt-0.5 text-[8px] text-zinc-600">Continue this conversation</p>
                  </div>
                  <span className="text-[11px] text-zinc-600">›</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
                  <div className="h-6 w-1 rounded-full bg-cyan-300/60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] font-medium text-zinc-200">Study session</p>
                    <p className="mt-0.5 text-[8px] text-zinc-600">Continue this conversation</p>
                  </div>
                  <span className="text-[11px] text-zinc-600">›</span>
                </div>
              </div>

              <div className="absolute inset-x-3.5 bottom-3">
                <div className="flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#171821] px-2.5 py-2 shadow-lg">
                  <Plus size={12} className="text-zinc-500" />
                  <span className="flex-1 text-[9px] text-zinc-500">Message GIA…</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                    <ArrowUp size={12} />
                  </div>
                </div>
                <div className="mx-auto mt-2 h-1 w-20 rounded-full bg-white/70" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2">
          {[
            { icon: Mic, title: 'Voice + vision', description: 'Speak naturally or show GIA what you see.' },
            { icon: ShieldCheck, title: 'You stay in control', description: 'Sensitive actions pause for your approval.' },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-white/[0.07] bg-black/15 p-2.5">
              <Icon size={14} className="mb-1.5 text-violet-300" />
              <p className="text-[10px] font-semibold" style={{ color: 'var(--gia-text)' }}>{title}</p>
              <p className="mt-1 text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>A concept preview of the GIA mobile experience.</p>
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
                  const subject = `[GIA ${feedbackType}] v2.4.0.17 Beta`;
                  const body = `${feedbackText.trim()}\n\n---\nGIA version: 2.4.0.17 Beta\nPlatform: ${isNativePlatform() ? 'Android/iOS' : 'Web Browser'}`;
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
          GIA v2.4.0.17 Beta · Built by Samuel Mensah · Alpha-1 Studio, Ghana
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
