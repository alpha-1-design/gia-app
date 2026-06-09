import React from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import type { ChatSession } from '../../store/useGiaStore';

interface HistoryPanelProps {
  sessions: ChatSession[];
  historySearch: string;
  setHistorySearch: (val: string) => void;
  setShowHistory: (val: boolean) => void;
  setActiveSession: (id: string) => void;
  createSession: () => string;
  deleteSession: (id: string) => void;
  activeSessionId: string | null;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  sessions,
  historySearch,
  setHistorySearch,
  setShowHistory,
  setActiveSession,
  createSession,
  deleteSession,
  activeSessionId,
}) => {
  return (
    <div className="flex flex-col h-full relative" style={{ background: 'var(--gia-bg)' }}>
      <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <button onClick={() => setShowHistory(false)} className="text-sm flex items-center gap-1" style={{ color: 'var(--gia-muted)' }}>
          ← Back
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Chats</span>
        <button onClick={() => { createSession(); setShowHistory(false); }} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#a855f7' }}>
          <Plus size={15} className="text-white" />
        </button>
      </div>
      <div className="px-4 pt-3 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--gia-muted-2)' }} />
          <input
            className="gia-input"
            style={{ paddingLeft: '30px', fontSize: '12px' }}
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            placeholder="Search chats..."
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sessions.filter(s => {
          if (s.title.toLowerCase().includes(historySearch.toLowerCase())) return true;
          if (!historySearch) return false;
          return s.messages.some(m => m.message.content.toLowerCase().includes(historySearch.toLowerCase()));
        }).map((sess) => {
          const matchCount = historySearch ? sess.messages.filter(m => m.message.content.toLowerCase().includes(historySearch.toLowerCase())).length : 0;
          return (
            <div key={sess.id} className="gia-card p-3 flex items-center gap-3 cursor-pointer transition-all tap-feedback" style={sess.id === activeSessionId ? { borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' } : {}} onClick={() => { setActiveSession(sess.id); setShowHistory(false); }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--gia-text)' }}>{sess.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{sess.messages.length} msgs · {new Date(sess.updatedAt).toLocaleDateString()}{matchCount > 0 ? ` · ${matchCount} match${matchCount > 1 ? 'es' : ''}` : ''}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(sess.id); }} className="p-1.5 rounded-lg transition-colors text-zinc-600 hover:text-rose-400">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
        {sessions.filter(s => {
          if (s.title.toLowerCase().includes(historySearch.toLowerCase())) return true;
          if (!historySearch) return false;
          return s.messages.some(m => m.message.content.toLowerCase().includes(historySearch.toLowerCase()));
        }).length === 0 && (
          <p className="text-xs text-center py-8" style={{ color: 'var(--gia-muted-2)' }}>No chats found{historySearch ? ` for "${historySearch}"` : ''}</p>
        )}
      </div>
    </div>
  );
};
