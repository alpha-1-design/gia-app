import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Circle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { TaskItem } from '../store/useGiaStore';

interface TaskProgressProps {
  tasks: TaskItem[];
  agentColor?: string;
}

const TaskProgress: React.FC<TaskProgressProps> = ({ tasks, agentColor = '#a855f7' }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ background: `${agentColor}08`, border: `1px solid ${agentColor}15` }}>
      {tasks.map((task, idx) => {
        const isExpanded = expandedId === task.id;
        const isLast = idx === tasks.length - 1;

        return (
          <div key={task.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : task.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:opacity-90"
            >
              {/* Status icon */}
              <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                {task.status === 'completed' ? (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: `${agentColor}20` }}>
                    <Check size={10} style={{ color: agentColor }} strokeWidth={3} />
                  </div>
                ) : task.status === 'in_progress' ? (
                  <div className="relative">
                    <Circle size={14} style={{ color: agentColor }} strokeWidth={2} />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-transparent"
                      style={{ borderTopColor: agentColor, borderRightColor: agentColor }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                ) : task.status === 'failed' ? (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
                    <span className="text-[8px]" style={{ color: '#ef4444' }}>!</span>
                  </div>
                ) : (
                  <Circle size={14} style={{ color: `${agentColor}40` }} strokeWidth={1.5} />
                )}
              </div>

              {/* Task label */}
              <span
                className={`text-xs flex-1 min-w-0 ${task.status === 'completed' ? 'line-through' : ''}`}
                style={{
                  color: task.status === 'completed'
                    ? `${agentColor}80`
                    : task.status === 'in_progress'
                      ? agentColor
                      : `${agentColor}50`,
                }}
              >
                {task.label}
              </span>

              {/* Expand toggle */}
              {task.details && (
                <span style={{ color: `${agentColor}50` }}>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              )}
            </button>

            {/* Expandable details */}
            <AnimatePresence>
              {isExpanded && task.details && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-2 pt-0 text-[10px] leading-relaxed whitespace-pre-wrap" style={{ color: `${agentColor}90`, borderTop: `1px solid ${agentColor}10`, margin: '0 12px', padding: '6px 0' }}>
                    {task.details}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connecting line */}
            {!isLast && (
              <div className="flex items-center ml-[22px] h-4">
                <div
                  className="w-[1.5px] h-full rounded-full"
                  style={{
                    background: tasks[idx + 1]?.status === 'pending'
                      ? `linear-gradient(to bottom, ${agentColor}60, ${agentColor}15)`
                      : `linear-gradient(to bottom, ${agentColor}60, ${agentColor}40)`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Streaming indicator on last task if still in_progress */}
      {tasks[tasks.length - 1]?.status === 'in_progress' && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[8px]" style={{ color: `${agentColor}50` }}>
          <Loader2 size={8} className="animate-spin" />
          Working...
        </div>
      )}
    </div>
  );
};

export default TaskProgress;
