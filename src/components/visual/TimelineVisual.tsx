import React, { useState, useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface TimelineData {
  events?: Record<string, unknown>[];
  title?: string;
}

export const TimelineVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as TimelineData;
  const events = d.events;
  const title = d.title;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();
  const copyData = useCallback(() => copy(JSON.stringify(events, null, 2)), [events, copy]);

  if (!events?.length) return null;

  const sorted = [...events].sort((a, b) => new Date(String(a.date || a.time || a.year)).getTime() - new Date(String(b.date || b.time || b.year)).getTime());

  return (
    <VisualCard title={title || 'Timeline'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="relative pl-6" style={{ maxHeight: expanded ? '600px' : '250px', overflowY: 'auto' }}>
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(to bottom, #a855f7, #3b82f6)' }} />
        {sorted.map((event: Record<string, unknown>, i: number) => (
          <div key={i} className="relative pb-4 last:pb-0">
            <div className="absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2" style={{ background: 'var(--gia-bg)', borderColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <div className="ml-2">
              <span className="text-[9px] font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{String(event.date || event.time || event.year)}</span>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--gia-text)' }}>{String(event.title || event.name)}</p>
              {event.description && <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{String(event.description)}</p>}
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
};
