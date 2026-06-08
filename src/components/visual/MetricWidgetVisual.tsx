import React, { useMemo, useCallback } from 'react';
import { Sun, Wind, Droplets, TrendingUp } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface WidgetDef {
  type: string;
  data: { label: string; value: string | number; unit?: string; change?: number; icon?: string; color?: string };
}

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  temperature: <Sun size={14} />,
  humidity: <Droplets size={14} />,
  wind: <Wind size={14} />,
  trend: <TrendingUp size={14} />,
};

export const MetricWidgetVisual: React.FC<{ data: WidgetDef[] | WidgetDef }> = ({ data }) => {
  const [copied, copy] = useCopy();
  const widgets = useMemo(() => Array.isArray(data) ? data : [data], [data]);
  const copyData = useCallback(() => copy(JSON.stringify(widgets, null, 2)), [widgets, copy]);

  return (
    <VisualCard title="Metrics" onCopy={copyData} copied={copied}>
      <div className="grid grid-cols-2 gap-3">
        {widgets.map((w, i) => {
          const d = w.data || w;
          const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {WIDGET_ICONS[d.icon || ''] && <span style={{ color }}>{WIDGET_ICONS[d.icon || '']}</span>}
                <span className="text-[9px] font-medium" style={{ color: 'var(--gia-muted-2)' }}>{d.label}</span>
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--gia-text)' }}>
                {d.value}{d.unit && <span className="text-[10px] ml-0.5" style={{ color: 'var(--gia-muted)' }}>{d.unit}</span>}
              </div>
              {d.change !== undefined && (
                <span className="text-[9px]" style={{ color: d.change >= 0 ? '#34d399' : '#f87171' }}>
                  {d.change >= 0 ? '\u2191' : '\u2193'} {Math.abs(d.change)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </VisualCard>
  );
};
