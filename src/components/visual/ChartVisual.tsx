import React, { useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];

interface ChartData {
  type?: string;
  labels?: string[];
  datasets?: Record<string, unknown[]>;
  title?: string;
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
}

export const ChartVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as ChartData;
  const type = d.type || 'bar';
  const labels = d.labels;
  const datasets = d.datasets;
  const title = d.title;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();

  const chartData = useMemo(() => {
    if (datasets && labels) {
      return labels.map((label: string, i: number) => {
        const row: Record<string, unknown> = { name: label };
        Object.keys(datasets).forEach(key => { row[key] = datasets[key][i]; });
        return row;
      });
    }
    return (d.rows || d.data || []) as Record<string, unknown>[];
  }, [datasets, labels, d]);

  const keys = useMemo(() => {
    if (datasets) return Object.keys(datasets);
    if (chartData.length > 0) return Object.keys(chartData[0]).filter(k => k !== 'name');
    return ['value'];
  }, [datasets, chartData]);

  const copyTable = useCallback(() => {
    const header = ['name', ...keys].join('\t');
    const rows = chartData.map((r: Record<string, unknown>) => [r.name, ...keys.map(k => r[k])].join('\t')).join('\n');
    copy(`${header}\n${rows}`);
  }, [chartData, keys, copy]);

  const containerHeight = expanded ? 400 : 220;

  if (!chartData.length) {
    return <div className="text-xs p-4 text-center" style={{ color: 'var(--gia-muted-2)' }}>No data to visualize</div>;
  }

  const commonProps = { width: '100%' as const, height: containerHeight };

  return (
    <VisualCard title={title || `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`} expanded={expanded} onToggle={() => setExpanded(!expanded)} onCopy={copyTable} copied={copied}>
      <div style={{ width: '100%', height: containerHeight }}>
        <ResponsiveContainer {...commonProps}>
          {type === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />)}
            </AreaChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie data={chartData} dataKey={keys[0]} nameKey="name" cx="50%" cy="50%" outerRadius={expanded ? 130 : 70} label={({ name, percent }: { name: string; percent: number }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={true}>
                {chartData.map((_: Record<string, unknown>, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </VisualCard>
  );
};
