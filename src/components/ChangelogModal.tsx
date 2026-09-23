import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wrench, CheckCircle2, Sparkles, ShieldCheck, Terminal } from 'lucide-react';

interface ChangelogProps {
  open: boolean;
  onClose: () => void;
}

const VERSION = '2.4.0.10';

const sections = [
  {
    key: 'added',
    title: 'Added',
    icon: Sparkles,
    color: '#a78bfa',
    items: [
      'Phone-first Capability Center with live status for providers, on-device models, camera, microphone, location, files, terminal, MCP, and notifications.',
      'Shared credential vault for API keys, tokens, and service secrets, with Android Keystore protection and secure chat prompts.',
      'Termux integration with availability checks, explicit command execution, working-directory support, and refusal when Termux is unavailable.',
      'Chat skill creation through the new skill_create tool, plus expanded follow-up suggestions and clarification guidance.',
      'Detailed Alpine and Ubuntu sandbox provisioning with package-manager detection, Debian package mappings, and progress reporting.',
      'Expanded the built-in provider catalogue from 22 to 71 entries, including hosted APIs, gateways, private endpoints, and local OpenAI-compatible servers.',
      'Added an About-page phone design preview showing the orb, fast actions, permission-first controls, secure connections, sandbox, and Termux capabilities.',
      'Added an in-app feedback and complaint form that opens a reviewed email to alphariansamuel@gmail.com, plus a GitHub issue shortcut.',
      'Termux commands now return stdout, stderr, exit code, and a job ID to GIA so she can inspect what actually happened before reporting completion.',
    ],
  },
  {
    key: 'fixed',
    title: 'Fixed',
    icon: Wrench,
    color: '#f59e0b',
    items: [
      'Found the actual bug behind every failed Full Install: it ran through a separate, never-updated copy of the proot launch code that none of the recent fixes touched. Consolidated into one shared path.',
      'Sandbox package index, install, repair, and reset failures now surface as failures instead of false success.',
      'Remote filesystem paths are canonicalized inside the workspace and clone inputs are validated against shell injection and traversal.',
      'Removed silent remote host fallback: a missing rootfs now blocks execution instead of running commands on the host.',
      'Native terminal startup and Android boot behavior are gated so GIA does not start expensive background services before setup is enabled.',
    ],
  },
  {
    key: 'security',
    title: 'Security & privacy',
    icon: ShieldCheck,
    color: '#34d399',
    items: [
      'MCP runtime tokens are removed from persisted server definitions and loaded through the shared credential vault.',
      'Added Android Keystore-backed AES-GCM storage with migration support for existing credential records.',
      'SSH host verification now uses accept-new behavior instead of silently disabling host-key checks.',
      'Sensitive actions remain approval-gated, with clearer capability and permission guidance in GIA’s system instructions.',
    ],
  },
  {
    key: 'changed',
    title: 'Changed',
    icon: Terminal,
    color: '#22d3ee',
    items: [
      'Sandbox tools now use the shared native/remote service instead of a desktop-only localhost path.',
      'File generation and document browsing self-provision their helper scripts inside the configured workspace.',
      'Gateway daemon configuration reloads preserve the last valid config, reconcile pollers, and no longer log Telegram token prefixes.',
      'Landing page and documentation now describe the phone app, Linux desktop companion, sandbox boundaries, credential handling, and release workflow.',
      'Version references across the app, Android package, documentation, user agent strings, and landing page are now 2.4.0.10.',
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