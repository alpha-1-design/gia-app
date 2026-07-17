import React, { useState } from 'react';
import { BarChart3, ChevronRight, Trash2 } from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import ConfirmDialog from '../../components/ConfirmDialog';

const ExamHistory: React.FC = () => {
  const [show, setShow] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const history = useGiaStore((s) => s.examHistory);
  const clearExamHistory = useGiaStore((s) => s.clearExamHistory);

  if (history.length === 0) return null;

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={() => setShow(e => !e)} className="flex items-center justify-between w-full tap-feedback">
        <div className="flex items-center gap-2">
          <BarChart3 size={13} style={{ color: '#f59e0b' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Past Results ({history.length})</span>
        </div>
        <ChevronRight size={13} style={{ color: 'var(--gia-muted)', transform: show ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {show && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {history.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--gia-surface-2)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0" style={{
                background: r.score >= 70 ? 'rgba(52,211,153,0.15)' : r.score >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: r.score >= 70 ? '#34d399' : r.score >= 40 ? '#f59e0b' : '#f87171',
              }}>
                {r.score}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: 'var(--gia-text)' }}>{r.subject}</p>
                <p className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>
                  {r.examSystem} · {r.correct}/{r.total} · {Math.floor(r.timeSpent / 60)}m
                </p>
              </div>
              <span className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>
                {new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {show && history.length > 0 && (
        <button onClick={() => setConfirmClear(true)}
          className="text-[10px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          <Trash2 size={10} /> Clear History
        </button>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear All Exam History?"
        message="This will permanently delete all exam history. This cannot be undone."
        confirmLabel="Clear All"
        danger
        onConfirm={() => { clearExamHistory(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};

export default ExamHistory;
