import React, { useState } from 'react';
import { Search, X, Brain, ChevronRight, Trash2 } from 'lucide-react';
import { useMemoryStore, MemoryCategory } from '../../store/useMemoryStore';
import ConfirmDialog from '../ConfirmDialog';

export const MemorySection: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const memories = useMemoryStore((s) => s.memories);
  const deleteMemory = useMemoryStore((s) => s.deleteMemory);
  const clearMemories = useMemoryStore((s) => s.clearMemories);

  const filtered = filter
    ? memories.filter(m => m.key.toLowerCase().includes(filter.toLowerCase()) || m.value.toLowerCase().includes(filter.toLowerCase()))
    : memories;

  const CATEGORY_COLORS: Record<MemoryCategory, string> = {
    profile: '#a855f7',
    subject: '#3b82f6',
    score: '#10b981',
    weak_area: '#f59e0b',
    fact: '#8888a0',
    preference: '#ec4899',
    session_summary: '#6366f1',
    project: '#22d3ee',
    correction: '#fb923c',
    emotion: '#f472b6',
    goal: '#34d399',
  };

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => setExpanded(e => !e)} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: '#a855f7' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Memory ({memories.length})
          </span>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="relative">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
            <input
              className="gia-input"
              style={{ paddingLeft: '28px', fontSize: '12px' }}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search memories..."
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-[11px] text-center py-4" style={{ color: 'var(--gia-muted-2)' }}>
              {memories.length === 0 ? 'No memories yet. Chat with GIA to build them.' : 'No matches.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {filtered.map(m => (
                <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: CATEGORY_COLORS[m.category] || '#8888a0' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-medium" style={{ color: 'var(--gia-text)' }}>{m.key}</span>
                      <span className="text-[8px] px-1 rounded" style={{ background: `${CATEGORY_COLORS[m.category]}20`, color: CATEGORY_COLORS[m.category] }}>{m.category}</span>
                    </div>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--gia-muted)' }}>{m.value}</p>
                  </div>
                  <button onClick={() => deleteMemory(m.id)} className="text-zinc-600 hover:text-rose-400 p-1 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {memories.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg w-full"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <Trash2 size={10} /> Clear All Memories
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear All Memories?"
        message="This will permanently delete all saved memories. This cannot be undone."
        confirmLabel="Clear All"
        danger
        onConfirm={() => { clearMemories(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
