import React, { useMemo, useCallback } from 'react';
import { Thermometer, Droplets, Wind, TrendingUp, TrendingDown, Users, DollarSign, Cpu, Activity, HeartPulse, Star, Battery, Eye, MousePointerClick, AlertTriangle, Clock, MapPin, Globe, MessageCircle, CheckCircle2, Server } from 'lucide-react';
import { VisualCard } from './common';
import { VIZ_COLORS, tint } from './palette';
import { useCopy } from './useCopy';

const WIDGET_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  temperature: Thermometer, temp: Thermometer, humidity: Droplets, moisture: Droplets,
  wind: Wind, speed: Wind, 'wind speed': Wind,
  trend: TrendingUp, growth: TrendingUp, conversions: TrendingUp, increase: TrendingUp,
  users: Users, user: Users, visitors: Users, people: Users, audience: Users,
  revenue: DollarSign, sales: DollarSign, money: DollarSign, price: DollarSign, cost: DollarSign,
  profit: DollarSign, income: DollarSign, earnings: DollarSign, budget: DollarSign,
  cpu: Cpu, memory: Cpu, ram: Cpu, disk: Cpu, storage: Cpu, compute: Cpu,
  network: Activity, latency: Activity, ping: Activity, signal: Activity, connection: Activity, requests: Activity,
  heart: HeartPulse, health: HeartPulse,
  star: Star, rating: Star, score: Star, quality: Star,
  battery: Battery, power: Battery, energy: Battery,
  views: Eye, impressions: Eye,
  clicks: MousePointerClick, tap: MousePointerClick, taps: MousePointerClick,
  error: AlertTriangle, errors: AlertTriangle, warning: AlertTriangle, loss: AlertTriangle, fail: AlertTriangle,
  time: Clock, duration: Clock, response: Clock,
  location: MapPin, map: MapPin, geo: MapPin,
  globe: Globe, world: Globe, country: Globe,
  message: MessageCircle, messages: MessageCircle, chat: MessageCircle,
  task: CheckCircle2, tasks: CheckCircle2,
  server: Server, uptime: Server,
};

interface WidgetDef {
  type: string;
  data: { label: string; value: string | number; unit?: string; change?: number; icon?: string; color?: string };
}

type WidgetItem = { label: string; value: string | number; unit?: string; change?: number; icon?: string; color?: string };

function isFlatObject(v: unknown): v is Record<string, string | number | boolean> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
    Object.values(v).every(val => typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean');
}

function normalizeMetrics(data: WidgetDef[] | WidgetDef): WidgetItem[] {
  const items = Array.isArray(data) ? data : [data];
  const result: WidgetItem[] = [];
  for (const w of items) {
    const inner = (w as { data?: unknown }).data || w;
    if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
      const obj = inner as Record<string, unknown>;
      if ('label' in obj && 'value' in obj) {
        result.push(obj as WidgetItem);
      } else if (isFlatObject(obj)) {
        for (const [key, val] of Object.entries(obj)) {
          result.push({ label: key, value: typeof val === 'boolean' ? String(val) : val });
        }
      } else {
        result.push(obj as WidgetItem);
      }
    }
  }
  return result;
}

function fmtVal(v: string | number): string {
  if (typeof v === 'number') {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
  }
  return v;
}

export const MetricWidgetVisual: React.FC<{ data: WidgetDef[] | WidgetDef }> = ({ data }) => {
  const [copied, copy] = useCopy();
  const widgets = useMemo(() => normalizeMetrics(data), [data]);
  const copyData = useCallback(() => copy(JSON.stringify(widgets, null, 2)), [widgets, copy]);

  return (
    <VisualCard title="Metrics" onCopy={copyData} copied={copied}>
      <div className="grid grid-cols-2 gap-3">
        {widgets.map((d, i) => {
          const color = d.color || VIZ_COLORS[i % VIZ_COLORS.length];
          const Icon = d.icon ? WIDGET_ICONS[d.icon.toLowerCase()] : undefined;
          return (
            <div key={i} className="group relative rounded-2xl p-3.5 overflow-hidden" style={{ background: tint(color, 0.07), border: `1px solid ${tint(color, 0.18)}` }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(120% 120% at 100% 0%, ${tint(color, 0.14)}, transparent 60%)` }} />
              <div className="relative flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--gia-muted)' }}>{d.label}</span>
                {Icon && (
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint(color, 0.16), color, boxShadow: `0 0 0 1px ${tint(color, 0.25)}` }}>
                    <Icon size={14} />
                  </span>
                )}
              </div>
              <div className="relative flex items-baseline gap-1">
                <span className="text-2xl font-extrabold leading-none tracking-tight" style={{ color: 'var(--gia-text)' }}>{fmtVal(d.value)}</span>
                {d.unit && <span className="text-[11px] font-semibold" style={{ color: 'var(--gia-muted)' }}>{d.unit}</span>}
              </div>
              {d.change !== undefined && (
                <div className="relative mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: d.change >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: d.change >= 0 ? '#34d399' : '#f87171' }}>
                  {d.change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span className="text-[10px] font-bold">{Math.abs(d.change)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </VisualCard>
  );
};
