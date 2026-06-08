import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target, Plus, Pause, Play, X, Trash2, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle, Clock, ListTodo, Settings2,
} from 'lucide-react';
import { useAutonomyStore, type Goal, type Plan } from '../store/useAutonomyStore';
import { autonomousAgent } from '../services/autonomy/AutonomousAgent';

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active: <div className="w-2 h-2 rounded-full bg-emerald-500" />,
  paused: <Pause size={12} className="text-amber-500" />,
  completed: <CheckCircle size={12} className="text-emerald-500" />,
  failed: <AlertCircle size={12} className="text-red-500" />,
};

function GoalCard({ goal, onToggle }: { goal: Goal; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const store = useAutonomyStore.getState();
  const plan = store.plans.find(p => p.id === goal.planId);
  const reflections = store.getGoalReflections(goal.id);

  return (
    <motion.div
      layout
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--gia-border)', background: 'var(--gia-surface)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {expanded ? <ChevronDown size={14} style={{ color: 'var(--gia-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--gia-muted)' }} />}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[goal.priority] }} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{goal.title}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted-2)' }}>
            {goal.progress}% · {goal.status}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {STATUS_ICONS[goal.status]}
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_COLORS[goal.priority]}22`, color: PRIORITY_COLORS[goal.priority] }}>
            {goal.priority}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--gia-border)' }}>
              <p className="text-[11px] pt-2" style={{ color: 'var(--gia-muted)' }}>{goal.description}</p>

              <div className="flex gap-1.5">
                {goal.status === 'active' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); store.setGoalStatus(goal.id, 'paused'); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}
                  >
                    <Pause size={10} /> Pause
                  </button>
                ) : goal.status === 'paused' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); store.setGoalStatus(goal.id, 'active'); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}
                  >
                    <Play size={10} /> Resume
                  </button>
                ) : null}
                <button
                  onClick={(e) => { e.stopPropagation(); store.removeGoal(goal.id); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-500"
                  style={{ background: 'var(--gia-surface-2)' }}
                >
                  <Trash2 size={10} /> Remove
                </button>
              </div>

              {plan && plan.steps.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Steps</div>
                  {plan.steps.map((step, i) => {
                    const icon = step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : step.status === 'failed' ? '❌' : '⬜';
                    return (
                      <div key={step.id} className="flex items-start gap-2 text-[11px] px-1 py-0.5">
                        <span>{icon}</span>
                        <span style={{ color: step.status === 'completed' ? 'var(--gia-muted-2)' : 'var(--gia-text)' }}>
                          {i + 1}. {step.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {reflections.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Reflections</div>
                  {reflections.slice(0, 3).map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-[10px] px-1 py-0.5" style={{ color: 'var(--gia-muted)' }}>
                      <span>{r.outcome === 'success' ? '✅' : r.outcome === 'failure' ? '❌' : '⚠️'}</span>
                      <span>{r.assessment}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AutonomyModule() {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [creating, setCreating] = useState(false);

  const { goals, config, setConfig, getActiveGoals } = useAutonomyStore();
  const activeGoals = getActiveGoals();
  const completedGoals = goals.filter(g => g.status === 'completed' || g.status === 'failed');

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await autonomousAgent.createGoal(title, description, priority);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setShowCreate(false);
    } catch (e) {
      console.error('Failed to create goal:', e);
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-emerald-500" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Autonomy</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfig({ enabled: !config.enabled })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
              config.enabled ? 'text-emerald-500' : 'text-zinc-500'
            }`}
            style={{ background: config.enabled ? 'rgba(52,211,153,0.1)' : 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
          >
            <Play size={10} />
            {config.enabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}
          >
            <Plus size={12} /> New Goal
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="mx-3 mb-2 p-3 rounded-xl space-y-2" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Goal title..."
                className="w-full text-[12px] bg-transparent outline-none px-2 py-1.5 rounded-lg"
                style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you want GIA to achieve..."
                rows={3}
                className="w-full text-[11px] bg-transparent outline-none px-2 py-1.5 rounded-lg resize-none"
                style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
              />
              <div className="flex gap-2">
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as typeof priority)}
                  className="text-[10px] px-2 py-1 rounded-lg outline-none"
                  style={{ background: 'var(--gia-surface)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  onClick={handleCreate}
                  disabled={creating || !title.trim()}
                  className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: creating ? 'var(--gia-muted-2)' : '#a855f7' }}
                >
                  {creating ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider px-1 pt-1 pb-1" style={{ color: 'var(--gia-muted-2)' }}>
          <ListTodo size={12} />
          Active Goals ({activeGoals.length})
        </div>

        {activeGoals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Target size={24} style={{ color: 'var(--gia-muted-2)' }} />
            <p className="text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>No active goals</p>
            <p className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>Create a goal and GIA will autonomously plan and execute it</p>
          </div>
        )}

        {activeGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal} onToggle={() => {}} />
        ))}

        {completedGoals.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider px-1 pt-3 pb-1" style={{ color: 'var(--gia-muted-2)' }}>
              <CheckCircle size={12} />
              History ({completedGoals.length})
            </div>
            {completedGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} onToggle={() => {}} />
            ))}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--gia-border)', background: 'var(--gia-surface)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            <Settings2 size={10} />
            Proactiveness
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(config.proactivenessLevel * 100)}
            onChange={e => setConfig({ proactivenessLevel: parseInt(e.target.value) / 100 })}
            className="w-24 h-1 rounded-full"
            style={{ accentColor: '#a855f7' }}
          />
          <span className="text-[10px] font-medium" style={{ color: 'var(--gia-text)' }}>
            {Math.round(config.proactivenessLevel * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
