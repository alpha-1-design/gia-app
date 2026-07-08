import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAgentStore } from '../store/useAgentStore';
import { resolveAgentIcon, resolveAgentColor } from '../utils/agentIcons';

interface AgentMentionPickerProps {
  query: string;
  onSelect: (id: string, name: string) => void;
}

const AgentMentionPicker: React.FC<AgentMentionPickerProps> = ({ query, onSelect }) => {
  const agents = useAgentStore(s => s.agents);
  const filtered = query
    ? agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
    : agents;

  if (agents.length === 0 || filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        className="absolute bottom-full left-0 right-0 mb-2 z-50"
      >
        <div
          className="rounded-2xl overflow-hidden shadow-2xl border max-h-48 overflow-y-auto"
          style={{ background: 'rgba(13, 13, 18, 0.98)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gia-muted-2)' }}>
            Agents
          </div>
          {filtered.map(agent => {
            const IconComp = resolveAgentIcon(agent.icon);
            const color = resolveAgentColor(agent.icon);
            return (
              <button
                key={agent.id}
                onClick={() => onSelect(agent.id, agent.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/5"
              >
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}20`, border: `1px solid ${color}30` }}
                >
                  <IconComp size={13} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>
                    @{agent.name}
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AgentMentionPicker;
