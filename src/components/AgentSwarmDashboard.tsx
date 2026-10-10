import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Crown, Layers, X } from 'lucide-react';
import { useNexusStore } from '../store/useNexusStore';
import { useGiaStore } from '../store/useGiaStore';
import { resolveAgentIcon } from '../utils/agentIcons';
import { useLiveTick } from '../hooks/useLiveTick';
import { DelegationTree } from './DelegationTree';

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
  const [dismissed, setDismissed] = useState(false);

  const isRunning = !!activeRun && !activeRun.finishedAt;
  useLiveTick(isRunning);

  // Reset dismissed state whenever a genuinely new run starts
  useEffect(() => { if (activeRun) setDismissed(false); }, [activeRun]);

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
                const Icon = resolveAgentIcon(a.icon);
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

        {/* Delegation tree — GIA root, spine, one branch per specialist */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[60vh] overflow-y-auto px-3 pb-3 pt-2">
                <DelegationTree
                  agents={activeRun.agents}
                  isGodMode={activeRun.isGodMode}
                  synthesizing={activeRun.synthesizing}
                  finished={!!activeRun.finishedAt}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgentSwarmDashboard;
