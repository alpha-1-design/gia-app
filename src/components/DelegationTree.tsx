import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronDown, ChevronUp, Layers } from 'lucide-react';
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
    <div
      className="overflow-hidden"
      style={{
        width: '100%',
        background: 'var(--gia-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
      }}
    >
      <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--gia-surface-2)' }}
        >
          <Icon size={14} style={{ color: 'var(--gia-text)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{agent.name}</span>
            <span className="text-[11px]" style={{ color: agent.status === 'failed' ? '#f87171' : '#a1a1aa' }}>
              {meta.label}
            </span>
            <span className="ml-auto text-[11px] tabular-nums shrink-0" style={{ color: '#71717a' }}>
              {(elapsed / 1000).toFixed(0)}s
            </span>
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: '#a1a1aa' }}>{agent.role}</div>
          {agent.currentActivity && isLive && (
            <div className="text-[13px] mt-1.5 leading-snug" style={{ color: '#e4e4e7' }}>
              {agent.currentActivity}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: '#71717a' }} className="shrink-0 mt-1" /> : <ChevronDown size={14} style={{ color: '#71717a' }} className="shrink-0 mt-1" />}
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
    </div>
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
              <span className="relative flex h-2 w-2 items-center justify-center rounded-full" style={{ background: isLive ? '#fafafa' : 'var(--gia-muted-2)' }} />
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
