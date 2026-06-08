import React from 'react';
import { FileText } from 'lucide-react';
import { useSummarizationStore } from '../../store/useSummarizationStore';
import { useShallow } from 'zustand/react/shallow';

interface SummaryBannerProps {
  sessionId: string;
  branchId: string;
}

export const SummaryBanner: React.FC<SummaryBannerProps> = ({ sessionId, branchId }) => {
  const summaries = useSummarizationStore(useShallow((s) => s.getSummaries(sessionId, branchId)));
  if (summaries.length === 0) return null;

  const latest = summaries[0];

  return (
    <div
      className="px-4 py-2.5 mx-4 rounded-xl flex items-start gap-2.5"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
    >
      <FileText size={13} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
      <div className="min-w-0">
        <p className="text-[10px] font-medium" style={{ color: '#f59e0b' }}>Summarized context</p>
        <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--gia-muted)' }}>
          {latest.summary.length > 200 ? latest.summary.slice(0, 200) + '…' : latest.summary}
        </p>
        <p className="text-[9px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>
          {latest.originalMsgCount} messages summarized · saved ~{latest.tokensSaved} tokens
        </p>
      </div>
    </div>
  );
};
