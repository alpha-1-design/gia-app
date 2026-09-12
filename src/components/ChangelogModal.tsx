import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PlusCircle, Wrench, Sparkles, CheckCircle2 } from 'lucide-react';

interface ChangelogProps {
  open: boolean;
  onClose: () => void;
}

const VERSION = '2.4.0.3';

const sections = [
  {
    key: 'added',
    title: 'Added',
    icon: PlusCircle,
    color: '#34d399',
    items: [
      'Floating Jarvis orb you can now talk to — hold the orb, say what you want, tap again to finish. It hears you with the same on-device Whisper brain that powers voice chats.',
      'Talk-to-the-orb now keeps working with no Whisper download: enable the Cloud STT fallback in Settings → Voice and it will route your clip to OpenAI or Groq.',
      'Tools catalog became actionable — tap any tool in the Tools list and GIA starts a ready-made request for it, instead of only copying its ID.',
      'New GIA Desktop (Linux) release surfaced across the app and landing page: terminal, files, sandbox, 270+ tools, a screen-aware orb, and phone ↔ desktop pairing.',
    ],
  },
  {
    key: 'fixed',
    title: 'Fixed',
    icon: Wrench,
    color: '#f59e0b',
    items: [
      'In-app updater no longer fails with "Failed to find configured root" on every install — the update root is resolved once and reused.',
      'Orb HUD no longer flashes graphical emoji on devices without emoji fonts — replaced with clean vector icons.',
    ],
  },
  {
    key: 'changed',
    title: 'Changed',
    icon: Sparkles,
    color: '#a78bfa',
    items: [
      'New-device onboarding now announces GIA Desktop and pairs nicely with a phone on the same network (Unimind mesh).',
      'Voice reality check: when an orb voice clip can\u2019t be processed, you get a clear next-step — download Whisper or enable the cloud fallback — instead of a dead silence.',
    ],
  },
];

const ChangelogModal: React.FC<ChangelogProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <CheckCircle2 size={16} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
                    {"What's New in v"}{VERSION}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
                    GIA app · release notes
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close changelog"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/[0.06]"
                style={{ color: 'var(--gia-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {sections.map(section => (
                <div key={section.key} className="mb-5 last:mb-0">
                  <div className="flex items-center gap-2 mb-2.5">
                    <section.icon size={13} style={{ color: section.color }} />
                    <p className="text-xs font-semibold" style={{ color: section.color }}>
                      {section.title}
                    </p>
                    <div className="flex-1 h-px" style={{ background: 'var(--gia-border)' }} />
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
                        <span className="mt-1.5 shrink-0" style={{ width: 4, height: 4, borderRadius: 999, background: section.color, opacity: 0.7 }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end px-5 py-3.5" style={{ borderTop: '1px solid var(--gia-border)' }}>
              <button
                onClick={onClose}
                className="text-xs px-5 py-2 rounded-xl transition-all font-medium"
                style={{
                  background: 'rgba(168,85,247,0.12)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  color: '#a855f7',
                }}
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChangelogModal;