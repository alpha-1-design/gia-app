import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Clock, Layers } from 'lucide-react';
import type { NexusAgentState } from '../store/useNexusStore';
import { resolveAgentIcon } from '../utils/agentIcons';
import { useLiveTick } from '../hooks/useLiveTick';

const STATUS_META: Record<NexusAgentState['status'], { label: string; color: string }> = {
  spawning: { label: 'Spawning', color: '#94a3b8' },
  running: { label: 'Working', color: '#a855f7' },
  completed: { label: 'Done', color: '#34d399' },
  failed: { label: 'Failed', color: '#f87171' },
};

export const AgentCard: React.FC<{ agent: NexusAgentState; expanded: boolean; onToggle: () => void }> = ({ agent, expanded, onToggle }) => {
  const Icon = resolveAgentIcon(agent.icon);
  const meta = STATUS_META[agent.status];
  const isLive = agent.status === 'running' || agent.status === 'spawning';
  const elapsed = agent.status === 'completed' || agent.status === 'failed'
    ? agent.duration
    : Date.now() - agent.startedAt;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="rounded-2xl overflow-hidden"
      style={{
        width: '100%',
        background: `linear-gradient(160deg, ${agent.color}14, rgba(13,13,18,0.9))`,
        border: `1px solid ${isLive ? agent.color + '55' : agent.color + '22'}`,
        boxShadow: isLive ? `0 0 18px ${agent.color}30` : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <button onClick={onToggle} className="w-full text-left p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `${agent.color}22`, border: `1px solid ${agent.color}44` }}
            >
              <Icon size={15} style={{ color: agent.color }} />
            </div>
            {isLive && (
              <motion.div
                className="absolute -inset-0.5 rounded-xl"
                style={{ border: `1.5px solid ${agent.color}` }}
                animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.12, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold truncate" style={{ color: 'var(--gia-text)' }}>{agent.name}</span>
              {agent.status === 'completed' && <CheckCircle2 size={10} style={{ color: meta.color }} className="shrink-0" />}
              {agent.status === 'failed' && <XCircle size={10} style={{ color: meta.color }} className="shrink-0" />}
              {isLive && <Loader2 size={10} className="animate-spin shrink-0" style={{ color: meta.color }} />}
            </div>
            <div className="text-[8.5px] truncate" style={{ color: agent.color, opacity: 0.85 }}>{agent.role}</div>
          </div>
          {expanded ? <ChevronUp size={11} style={{ color: 'var(--gia-muted-2)' }} className="shrink-0" /> : <ChevronDown size={11} style={{ color: 'var(--gia-muted-2)' }} className="shrink-0" />}
        </div>

        <div className="flex items-center gap-1.5 text-[8.5px]" style={{ color: 'var(--gia-muted-2)' }}>
          <Clock size={9} />
          <span>{(elapsed / 1000).toFixed(1)}s</span>
          <span className="opacity-40">•</span>
          <span style={{ color: meta.color }}>{meta.label}</span>
        </div>

        {agent.currentActivity && isLive && (
          <div className="text-[9px] truncate italic" style={{ color: 'var(--gia-muted-2)' }}>
            {agent.currentActivity}
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: `${agent.color}22` }}>
              <div className="text-[8px] font-semibold uppercase tracking-wider mb-1 mt-2" style={{ color: 'var(--gia-muted-2)' }}>Task</div>
              <div className="text-[9.5px] leading-relaxed mb-2 max-h-16 overflow-y-auto" style={{ color: 'var(--gia-text)', opacity: 0.85 }}>
                {agent.task || '—'}
              </div>
              {agent.status === 'completed' && agent.result && (
                <>
                  <div className="text-[8px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#34d399' }}>Findings</div>
                  <div className="text-[9.5px] leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--gia-text)', opacity: 0.85 }}>
                    {agent.result.slice(0, 600)}{agent.result.length > 600 ? '…' : ''}
                  </div>
                </>
              )}
              {agent.status === 'failed' && agent.error && (
                <>
                  <div className="text-[8px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#f87171' }}>Error</div>
                  <div className="text-[9.5px] leading-relaxed" style={{ color: '#f87171', opacity: 0.85 }}>
                    {agent.error}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const RAIL_X = 14;

/**
 * DelegationTree — renders a Nexus run the way an orchestrator actually works:
 * a GIA root node, a vertical spine dropping down, and one horizontal branch
 * per specialist as it is dispatched, ending in the synthesis node. Each row
 * repeats the previous row's spine segment plus its own elbow, so the whole
 * structure stays connected as agents change height (expand, grow output).
 *
 * Shared by the in-chat swarm dashboard and the Nexus run monitor.
 */
export const DelegationTree: React.FC<{
  agents: NexusAgentState[];
  isGodMode: boolean;
  synthesizing: boolean;
  finished: boolean;
}> = ({ agents, isGodMode, synthesizing, finished }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useLiveTick(agents.some(a => a.status === 'running' || a.status === 'spawning'));

  const accent = isGodMode ? '#f59e0b' : '#a855f7';
  const spine = isGodMode ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.26)';
  const stub = isGodMode ? 'rgba(245,158,11,0.45)' : 'rgba(168,85,247,0.4)';
  const showSynth = synthesizing || finished;
  const done = agents.filter(a => a.status === 'completed').length;

  const rail = (opts: { first?: boolean; last?: boolean; marker: React.ReactNode; stubColor?: string }) => (
    <div className="relative w-7 shrink-0 self-stretch">
      {!opts.first && <span className="absolute top-0 h-[14px] w-px -translate-x-1/2" style={{ left: RAIL_X, background: spine }} />}
      {!opts.last && <span className="absolute top-[14px] bottom-0 w-px -translate-x-1/2" style={{ left: RAIL_X, background: spine }} />}
      <span className="absolute top-[14px] h-px w-[14px] -translate-y-1/2" style={{ left: RAIL_X, background: opts.stubColor ?? stub }} />
      <span className="absolute top-[14px] flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ left: RAIL_X }}>{opts.marker}</span>
    </div>
  );

  return (
    <div className="relative">
      {/* Root — the orchestrator */}
      <div className="relative flex">
        {rail({ first: true, marker: (
          <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `${accent}22`, border: `1px solid ${accent}66` }}>
            <Layers size={9} style={{ color: accent }} />
          </span>
        ) })}
        <div className="min-w-0 flex-1 pb-2 pl-1">
          <p className="text-[11px] font-bold" style={{ color: 'var(--gia-text)' }}>
            GIA {isGodMode ? '· extended orchestration' : '· orchestrator'}
          </p>
          <p className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
            {synthesizing
              ? 'Combining specialist findings…'
              : finished
                ? `Synthesis complete — ${done}/${agents.length} specialists reported`
                : `Dispatching ${agents.length} specialist${agents.length === 1 ? '' : 's'}…`}
          </p>
        </div>
      </div>

      {/* One horizontal branch per specialist, in dispatch order */}
      {agents.map((agent, i) => {
        const isLastRow = !showSynth && i === agents.length - 1;
        const isLive = agent.status === 'running' || agent.status === 'spawning';
        return (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.05 }}
            className="relative flex"
          >
            {rail({ last: isLastRow, stubColor: `${agent.color}99`, marker: (
              <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ background: `${agent.color}30`, border: `1.5px solid ${agent.color}` }}>
                {isLive && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    style={{ border: `1.5px solid ${agent.color}` }}
                    animate={{ scale: [1, 1.8], opacity: [0.65, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span className="h-1 w-1 rounded-full" style={{ background: agent.color }} />
              </span>
            ) })}
            <div className="min-w-0 flex-1 pb-2.5 pl-1">
              <AgentCard
                agent={agent}
                expanded={expandedId === agent.id}
                onToggle={() => setExpandedId(id => id === agent.id ? null : agent.id)}
              />
            </div>
          </motion.div>
        );
      })}

      {/* Synthesis node — the spine's terminus */}
      {showSynth && (
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="relative flex">
          {rail({ last: true, stubColor: `${accent}99`, marker: (
            <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: `${accent}22`, border: `1px solid ${accent}66` }}>
              <Sparkles size={9} style={{ color: accent }} />
            </span>
          ) })}
          <div className="min-w-0 flex-1 pb-1 pl-1">
            <p className="text-[10.5px] font-semibold" style={{ color: accent }}>
              {synthesizing ? 'GIA is combining specialist findings…' : 'Merged into one response'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
