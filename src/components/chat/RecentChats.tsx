import React from 'react';
import { ChevronRight, History } from 'lucide-react';
import type { ChatSession } from '../../store/useGiaStore';
import { useGiaStore } from '../../store/useGiaStore';
import { getRecentChatItems } from './recentChatsUtils';

function formatUpdatedAt(timestamp: number): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return 'Yesterday';
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface RecentChatsProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onResume: (sessionId: string) => void;
}

const RecentChats: React.FC<RecentChatsProps> = ({ sessions, activeSessionId, onResume }) => {
  const recentChats = getRecentChatItems(
    sessions,
    activeSessionId,
    (sessionId, branchId) => useGiaStore.getState().getBranchMessages(sessionId, branchId),
  );

  if (recentChats.length === 0) return null;

  return (
    <section className="w-full max-w-xs text-left" aria-label="Recent conversations">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <History size={12} style={{ color: '#a78bfa' }} />
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--gia-muted)' }}>
          Pick up where you left off
        </h2>
      </div>
      <div className="space-y-1.5">
        {recentChats.map(({ session, preview }) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onResume(session.id)}
            aria-label={`Resume conversation: ${session.title}`}
            className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors hover:border-violet-400/30 hover:bg-white/[0.035] tap-feedback"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--gia-border)' }}
          >
            <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: 'linear-gradient(180deg, #a78bfa, #6366f1)' }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium" style={{ color: 'var(--gia-text)' }}>{session.title}</span>
                <span className="shrink-0 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{formatUpdatedAt(session.updatedAt)}</span>
              </span>
              <span className="mt-0.5 block truncate text-[10px]" style={{ color: 'var(--gia-muted)' }}>{preview}</span>
            </span>
            <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--gia-muted-2)' }} />
          </button>
        ))}
      </div>
    </section>
  );
};

export default RecentChats;
