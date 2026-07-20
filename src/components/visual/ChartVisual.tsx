import React, { useState, useMemo, useCallback, useId } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { VisualCard } from './common';
import { VIZ_COLORS, tint } from './palette';
import { useCopy } from './useCopy';

interface ChartData {
  type?: string;
  labels?: string[];
  datasets?: Record<string, unknown[]>;
  title?: string;
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
}

interface TipPayloadItem { name?: string; value?: number | string; color?: string; }
interface CustomTooltipProps { active?: boolean; payload?: TipPayloadItem[]; label?: string | number; }

const fmtVal = (v: number | string): string => {
  if (typeof v === 'number') {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
  }
  return v;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
      {label !== undefined && <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--gia-muted)' }}>{String(label)}</p>}
      <div className="flex flex-col gap-1 min-w-[120px]">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="font-medium truncate" style={{ color: 'var(--gia-text)' }}>{p.name}</span>
            <span className="font-bold ml-auto pl-2" style={{ color: 'var(--gia-text)' }}>{fmtVal(p.value as number | string)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as ChartData;
  const type = d.type || 'bar';
  const labels = d.labels;
  const datasets = d.datasets;
  const title = d.title;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();
  const uid = useId().replace(/:/g, '');

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

  const containerHeight = expanded ? 380 : 240;

  if (!chartData.length) {
    return <div className="text-xs p-4 text-center" style={{ color: 'var(--gia-muted-2)' }}>No data to visualize</div>;
  }

  const axisProps = {
    tick: { fontSize: 11, fill: 'var(--gia-muted)' },
    tickLine: false,
    axisLine: { stroke: 'var(--gia-border)', strokeWidth: 1 },
  } as const;

  const defs = (
    <defs>
      {keys.map((k, i) => {
        const c = VIZ_COLORS[i % VIZ_COLORS.length];
        return (
          <linearGradient key={`${uid}-${k}`} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={0.5} />
            <stop offset="100%" stopColor={c} stopOpacity={0.03} />
          </linearGradient>
        );
      })}
    </defs>
  );

  return (
    <VisualCard title={title || `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`} expanded={expanded} onToggle={() => setExpanded(!expanded)} onCopy={copyTable} copied={copied}>
      <div style={{ width: '100%', height: containerHeight }} role="img" aria-label={title || `${type} chart`}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={36} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--gia-accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--gia-muted)' }} iconType="circle" iconSize={8} />
              {keys.map((k, i) => {
                const c = VIZ_COLORS[i % VIZ_COLORS.length];
                return <Line key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={2.5} dot={{ r: 3, fill: c, strokeWidth: 0 }} activeDot={{ r: 5 }} style={{ filter: `drop-shadow(0 0 4px ${tint(c, 0.5)})` }} animationDuration={700} />;
              })}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={36} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--gia-accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--gia-muted)' }} iconType="circle" iconSize={8} />
              {keys.map((k, i) => {
                const c = VIZ_COLORS[i % VIZ_COLORS.length];
                return <Area key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={2.5} fill={`url(#${uid}-g${i})`} animationDuration={700} />;
              })}
            </AreaChart>
          ) : type === 'pie' ? (
            <PieChart>
              {defs}
              <Pie
                data={chartData}
                dataKey={keys[0]}
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={expanded ? 72 : 40}
                outerRadius={expanded ? 120 : 64}
                paddingAngle={3}
                stroke="var(--gia-surface)"
                strokeWidth={2}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
                animationDuration={700}
              >
                {chartData.map((_: Record<string, unknown>, i: number) => (
                  <Cell key={i} fill={VIZ_COLORS[i % VIZ_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--gia-muted)' }} iconType="circle" iconSize={8} />
            </PieChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              {defs}
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" vertical={false} />
              <XAxis dataKey="name" {...axisProps} minTickGap={16} />
              <YAxis {...axisProps} width={36} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--gia-muted)' }} iconType="circle" iconSize={8} />
              {keys.map((k, i) => {
                const c = VIZ_COLORS[i % VIZ_COLORS.length];
                return <Bar key={k} dataKey={k} fill={`url(#${uid}-g${i})`} stroke={c} strokeWidth={1.5} radius={[6, 6, 0, 0]} maxBarSize={48} animationDuration={700} />;
              })}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </VisualCard>
  );
};
