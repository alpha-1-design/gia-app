import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, AlertTriangle, Check, Cpu, Loader2, Search, Sparkles, Wifi } from 'lucide-react';
import type { CollaborativeProviderPhase, CollaborativeProviderStatus } from '../../services/providers/types';
import { providerRegistry } from '../../services/ProviderRegistry';

const PHASES: Record<CollaborativeProviderPhase, { label: string; color: string; icon: React.ReactNode }> = {
  checking: { label: 'Testing endpoint', color: '#60a5fa', icon: <Wifi size={12} /> },
  thinking: { label: 'Working independently', color: '#c084fc', icon: <Cpu size={12} /> },
  researching: { label: 'Using tools / gathering context', color: '#22d3ee', icon: <Search size={12} /> },
  responding: { label: 'Preparing response', color: '#a78bfa', icon: <Activity size={12} /> },
  synthesizing: { label: 'Synthesizing responses', color: '#f0abfc', icon: <Sparkles size={12} /> },
  done: { label: 'Ready', color: '#34d399', icon: <Check size={12} /> },
  error: { label: 'Skipped — endpoint unavailable', color: '#fb7185', icon: <AlertTriangle size={12} /> },
};

const ACTIVE_PHASES = new Set<CollaborativeProviderPhase>(['checking', 'thinking', 'researching', 'responding', 'synthesizing']);

export const CollaborationActivity: React.FC<{ providers: CollaborativeProviderStatus[] }> = ({ providers }) => {
  if (providers.length === 0) return null;
  const activeCount = providers.filter(provider => ACTIVE_PHASES.has(provider.status)).length;
  const readyCount = providers.filter(provider => provider.status === 'done').length;

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 5 }}
        aria-label="Multi-provider collaboration activity"
        className="mx-3 mb-2 overflow-hidden rounded-2xl border"
        style={{
          background: 'linear-gradient(125deg, rgba(76,29,149,0.18), rgba(15,17,29,0.96) 42%, rgba(13,20,34,0.96))',
          borderColor: 'rgba(167,139,250,0.22)',
          boxShadow: activeCount > 0 ? '0 8px 28px rgba(109,40,217,0.1)' : 'none',
        }}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border" style={{ background: 'rgba(168,85,247,0.12)', borderColor: 'rgba(192,132,252,0.2)', color: '#d8b4fe' }}>
            <Sparkles size={15} />
            {activeCount > 0 && (
              <motion.span
                className="absolute -inset-1 rounded-[14px] border"
                style={{ borderColor: 'rgba(192,132,252,0.45)' }}
                animate={{ opacity: [0.5, 0], scale: [0.92, 1.32] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--gia-text)' }}>GIA collaboration</p>
              <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.16)', color: '#c4b5fd' }}>
                {activeCount > 0 ? 'Live' : 'Run complete'}
              </span>
            </div>
            <p className="mt-0.5 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              {activeCount > 0 ? `${activeCount} provider${activeCount === 1 ? '' : 's'} active` : `${readyCount} provider${readyCount === 1 ? '' : 's'} responded`}
              {' · '}up to 3 cloud endpoints · local AI excluded
            </p>
          </div>
          {activeCount > 0 && <Loader2 size={13} className="animate-spin" style={{ color: '#c4b5fd' }} />}
        </div>

        <div className="grid gap-1.5 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map(provider => {
            const phase = PHASES[provider.status];
            const running = ACTIVE_PHASES.has(provider.status);
            return (
              <article key={`${provider.provider}:${provider.model}`} className="min-w-0 rounded-xl border px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.025)', borderColor: `${phase.color}28` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold uppercase" style={{ background: `${phase.color}18`, color: phase.color }}>
                    {providerRegistry.getLabel(provider.provider).slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold" style={{ color: 'var(--gia-text)' }}>{providerRegistry.getLabel(provider.provider)}</p>
                    <p className="truncate text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>{provider.model}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[8px] font-medium" style={{ color: phase.color }}>
                    {running ? <Loader2 size={9} className="animate-spin" /> : phase.icon}
                    {phase.label}
                  </span>
                </div>
                {provider.activity && (
                  <p className="mt-1.5 line-clamp-2 pl-8 text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>{provider.activity}</p>
                )}
              </article>
            );
          })}
        </div>
      </motion.section>
    </AnimatePresence>
  );
};
