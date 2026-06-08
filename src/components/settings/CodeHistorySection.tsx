import React, { useState } from 'react';
import { Code2, ChevronRight, Trash2 } from 'lucide-react';
import CodeRunner from '../../services/CodeRunner';
import ConfirmDialog from '../ConfirmDialog';

export const CodeHistorySection: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(() => CodeRunner.getHistory());
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = () => setHistory(CodeRunner.getHistory());

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button onClick={() => { setExpanded(e => !e); if (!expanded) refresh(); }} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <Code2 size={14} style={{ color: '#10b981' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
            Code Runs ({history.length})
          </span>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--gia-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {history.length === 0 ? (
            <p className="text-[11px] text-center py-4" style={{ color: 'var(--gia-muted-2)' }}>No code runs yet.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {history.map(r => (
                <div key={r.id} className="px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>{r.language}</span>
                    <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{new Date(r.ts).toLocaleString()}</span>
                    <span className="text-[9px]" style={{ color: r.exitCode === 0 ? '#34d399' : '#f87171' }}>exit {r.exitCode}</span>
                  </div>
                  <p className="text-[10px] mt-1 truncate font-mono" style={{ color: 'var(--gia-muted)' }}>{r.code.slice(0, 120)}</p>
                  {r.error && <p className="text-[9px] mt-0.5 truncate" style={{ color: '#f87171' }}>✕ {r.error.slice(0, 100)}</p>}
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg w-full"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <Trash2 size={10} /> Clear History
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear Code History?"
        message="This will permanently delete all code run history."
        confirmLabel="Clear"
        danger
        onConfirm={() => { CodeRunner.clearHistory(); refresh(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
