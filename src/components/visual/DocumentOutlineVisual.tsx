import React, { useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface OutlineData {
  headings?: Record<string, unknown>[];
  title?: string;
}

export const DocumentOutlineVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as OutlineData;
  const headings = d.headings;
  const title = d.title;
  const [copied, copy] = useCopy();
  const copyData = useCallback(() => copy(headings?.map((h: Record<string, unknown>) => `${'  '.repeat(((h.level as number) || 1) - 1)}${h.text}`).join('\n') || ''), [headings, copy]);

  if (!headings?.length) return null;

  return (
    <VisualCard title={title || 'Document Outline'} onCopy={copyData} copied={copied}>
      <nav>
        {headings.map((h: Record<string, unknown>, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${((h.level as number) || 1) - 1}px` }}>
            <div className="w-1 h-1 rounded-full" style={{ background: CHART_COLORS[((h.level as number) || 1) % CHART_COLORS.length] }} />
            <span className="text-[11px] cursor-pointer hover:opacity-80" style={{ color: 'var(--gia-muted)', fontWeight: (h.level as number) <= 2 ? 600 : 400 }}>{h.text as string}</span>
          </div>
        ))}
      </nav>
    </VisualCard>
  );
};
