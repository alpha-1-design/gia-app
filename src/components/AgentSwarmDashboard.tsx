import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, TrendingUp, AlertTriangle, Lightbulb, GitMerge, Compass, Zap, Code2,
  Navigation2, ShieldCheck, Thermometer, Sun, Heart, BookOpen, Handshake, Brain,
  GraduationCap, Eye as EyeIcon, Sparkles, Share2, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, Clock, Layers, Crown, X,
} from 'lucide-react';
import { useNexusStore, NexusAgentState } from '../store/useNexusStore';
import { useGiaStore } from '../store/useGiaStore';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  Search, TrendingUp, AlertTriangle, Lightbulb, GitMerge, Compass, Zap, Code2,
  Navigation2, ShieldCheck, Thermometer, Sun, Heart, BookOpen, Handshake, Brain,
  GraduationCap, Eye: EyeIcon, Sparkles, Share2,
};

function iconFor(name: string) {
  return ICONS[name] || Sparkles;
}

function useLiveTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 400);
    return () => clearInterval(id);
  }, [active]);
}

const STATUS_META: Record<NexusAgentState['status'], { label: string; color: string }> = {
  spawning: { label: 'Spawning', color: '#94a3b8' },
  running: { label: 'Working', color: '#a855f7' },
  completed: { label: 'Done', color: '#34d399' },
  failed: { label: 'Failed', color: '#f87171' },
};

const AgentCard: React.FC<{ agent: NexusAgentState; expanded: boolean; onToggle: () => void }> = ({ agent, expanded, onToggle }) => {
  const Icon = iconFor(agent.icon);
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

const AgentSwarmDashboard: React.FC = () => {
  const rawActiveRun = useNexusStore(s => s.activeRun);
  const clearRun = useNexusStore(s => s.clearRun);
  const activeSessionId = useGiaStore(s => s.activeSessionId);
  // A run belongs to the session that launched it. Without this check, an
  // in-flight or just-finished Nexus run from a session the user has since
  // left would keep rendering on top of whatever session (including a brand
  // new chat) they switched to next.
  const activeRun = rawActiveRun && rawActiveRun.sessionId === (activeSessionId ?? null) ? rawActiveRun : null;
  const [collapsed, setCollapsed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isRunning = !!activeRun && !activeRun.finishedAt;
  useLiveTick(isRunning);

  // Reset dismissed state whenever a genuinely new run starts
  useEffect(() => { if (activeRun) setDismissed(false); }, [activeRun?.id]);

  // Auto-collapse to a slim summary bar a few seconds after everything finishes
  useEffect(() => {
    if (activeRun?.finishedAt) {
      const t = setTimeout(() => setDismissed(true), 8000);
      return () => clearTimeout(t);
    }
  }, [activeRun?.finishedAt]);

  const summary = useMemo(() => {
    if (!activeRun) return null;
    const done = activeRun.agents.filter(a => a.status === 'completed').length;
    const failed = activeRun.agents.filter(a => a.status === 'failed').length;
    const total = activeRun.agents.length;
    return { done, failed, total };
  }, [activeRun]);

  if (!activeRun || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-3 mb-2 rounded-2xl overflow-hidden"
        style={{
          background: activeRun.isGodMode
            ? 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(13,13,18,0.96))'
            : 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(13,13,18,0.96))',
          border: `1px solid ${activeRun.isGodMode ? 'rgba(217,119,6,0.3)' : 'rgba(168,85,247,0.2)'}`,
          boxShadow: isRunning ? `0 0 24px ${activeRun.isGodMode ? 'rgba(217,119,6,0.12)' : 'rgba(168,85,247,0.1)'}` : 'none',
        }}
      >
        {/* Header bar */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5"
        >
          <div className="relative shrink-0">
            <Layers size={15} style={{ color: activeRun.isGodMode ? '#f59e0b' : '#a855f7' }} />
            {isRunning && (
              <motion.div
                className="absolute -inset-1 rounded-full"
                style={{ background: activeRun.isGodMode ? '#f59e0b' : '#a855f7', opacity: 0.15 }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.25, 0, 0.25] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-bold" style={{ color: 'var(--gia-text)' }}>
                Nexus{activeRun.isGodMode ? ' · GOD MODE' : ''}
              </span>
              {activeRun.isGodMode && <Crown size={10} style={{ color: '#f59e0b' }} />}
            </div>
            <div className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
              {activeRun.synthesizing
                ? 'Synthesizing findings…'
                : isRunning
                  ? `${summary?.done}/${summary?.total} agents done${summary && summary.failed > 0 ? ` · ${summary.failed} failed` : ''}`
                  : `Finished — ${summary?.done}/${summary?.total} succeeded${summary && summary.failed > 0 ? `, ${summary.failed} failed` : ''}`
              }
            </div>
          </div>

          {/* Mini avatar stack when collapsed */}
          {collapsed && (
            <div className="flex -space-x-2 mr-1">
              {activeRun.agents.slice(0, 5).map(a => {
                const Icon = iconFor(a.icon);
                return (
                  <div key={a.id} className="w-6 h-6 rounded-full flex items-center justify-center border-2" style={{ background: `${a.color}30`, borderColor: 'rgba(13,13,18,1)' }}>
                    <Icon size={10} style={{ color: a.color }} />
                  </div>
                );
              })}
            </div>
          )}

          {!isRunning && (
            <span
              onClick={(e) => { e.stopPropagation(); setDismissed(true); clearRun(); }}
              className="p-1 rounded hover:bg-white/5 shrink-0"
              role="button"
            >
              <X size={12} style={{ color: 'var(--gia-muted-2)' }} />
            </span>
          )}
          {collapsed ? <ChevronDown size={12} style={{ color: 'var(--gia-muted-2)' }} /> : <ChevronUp size={12} style={{ color: 'var(--gia-muted-2)' }} />}
        </button>

        {/* Progress bar */}
        {isRunning && summary && summary.total > 0 && (
          <div className="h-0.5 w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="h-full"
              style={{ background: activeRun.isGodMode ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #a855f7, #6366f1)' }}
              animate={{ width: `${((summary.done + summary.failed) / summary.total) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}

        {/* Agent card strip */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden max-h-[60vh]"
            >
              <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
                {activeRun.agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    expanded={expandedId === agent.id}
                    onToggle={() => setExpandedId(id => id === agent.id ? null : agent.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgentSwarmDashboard;
