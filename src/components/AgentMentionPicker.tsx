import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send } from 'lucide-react';
import { useAgentStore } from '../store/useAgentStore';
import { useProviderStore } from '../store/useProviderStore';
import { providerMonitor } from '../services/ProviderMonitor';
import { resolveAgentIcon, resolveAgentColor } from '../utils/agentIcons';

const HEALTH_DOT: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#eab308',
  down: '#ef4444',
};

interface AgentMentionPickerProps {
  query: string;
  /** task is optional — when provided, the mention carries an explicit,
   *  agent-specific instruction instead of relying on shared free text. */
  onSelect: (id: string, name: string, task?: string) => void;
}

const AgentMentionPicker: React.FC<AgentMentionPickerProps> = ({ query, onSelect }) => {
  const agents = useAgentStore(s => s.agents);
  const activeProvider = useProviderStore(s => s.activeProvider);
  const providers = useProviderStore(s => s.providers);
  const [pickedAgent, setPickedAgent] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  const filtered = query
    ? agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : agents;

  if (agents.length === 0 || (!pickedAgent && filtered.length === 0)) return null;

  const health = providerMonitor.getHealth(activeProvider, providers[activeProvider]?.model || '');

  const submitTask = () => {
    if (!pickedAgent) return;
    onSelect(pickedAgent.id, pickedAgent.name, taskDraft.trim() || undefined);
    setPickedAgent(null);
    setTaskDraft('');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        className="absolute bottom-full left-0 right-0 mb-2 z-50"
      >
        <div
          className="rounded-2xl overflow-hidden shadow-2xl border max-h-64 overflow-y-auto"
          style={{ background: 'rgba(13, 13, 18, 0.98)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {pickedAgent ? (
            <div className="p-3">
              <button
                onClick={() => { setPickedAgent(null); setTaskDraft(''); }}
                className="flex items-center gap-1 text-[9px] mb-2 opacity-70 hover:opacity-100"
                style={{ color: 'var(--gia-muted-2)' }}
              >
                <ArrowLeft size={10} /> Back
              </button>
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const IconComp = resolveAgentIcon(pickedAgent.icon);
                  const color = resolveAgentColor(pickedAgent.icon);
                  return (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                      <IconComp size={12} style={{ color }} />
                    </div>
                  );
                })()}
                <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                  Task for @{pickedAgent.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={taskDraft}
                  onChange={e => setTaskDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
                  placeholder={`What should ${pickedAgent.name} specifically do?`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gia-text)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <button
                  onClick={submitTask}
                  className="p-1.5 rounded-lg shrink-0"
                  style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
                  title="Confirm task"
                >
                  <Send size={12} />
                </button>
              </div>
              <div className="text-[8px] mt-1.5 opacity-60" style={{ color: 'var(--gia-muted-2)' }}>
                Leave blank to just @mention with no specific task — Enter to confirm.
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gia-muted-2)' }}>
                Agents — via {activeProvider}
              </div>
              {filtered.map(agent => {
                const IconComp = resolveAgentIcon(agent.icon);
                const color = resolveAgentColor(agent.icon);
                return (
                  <button
                    key={agent.id}
                    onClick={() => setPickedAgent({ id: agent.id, name: agent.name, icon: agent.icon })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/5"
                  >
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}20`, border: `1px solid ${color}30` }}
                    >
                      <IconComp size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                          @{agent.name}
                        </span>
                        <span className="flex items-center gap-1 px-1 py-0.5 rounded text-[7px] font-medium uppercase tracking-wider" style={{ background: `${HEALTH_DOT[health.status]}12`, color: HEALTH_DOT[health.status] }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: HEALTH_DOT[health.status] }} />
                          {activeProvider}
                        </span>
                      </div>
                      {agent.description && (
                        <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
                          {agent.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgentMentionPicker;
