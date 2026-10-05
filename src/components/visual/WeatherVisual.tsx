import React, { useId, useMemo, useState } from 'react';
import { Droplets, Wind, Gauge, Thermometer, Leaf, ChevronDown } from 'lucide-react';
import { aqiBand, formatTemp, normalizeCondition, type WeatherCondition } from './weatherUtils';

interface ForecastDay { day: string; temp?: number; high?: number; low?: number; condition?: string }

export interface WeatherData {
  location?: string;
  temp?: number | string;
  unit?: 'C' | 'F' | string;
  condition?: string;
  description?: string;
  feelsLike?: number;
  humidity?: number;
  wind?: number;
  windUnit?: string;
  pressure?: number;
  aqi?: number;
  high?: number;
  low?: number;
  forecast?: ForecastDay[];
}

const SKY: Record<WeatherCondition, { glow: string; label: string }> = {
  sunny: { glow: '251, 191, 36', label: 'Sunny' },
  'clear-night': { glow: '129, 140, 248', label: 'Clear night' },
  'partly-cloudy': { glow: '251, 191, 36', label: 'Partly cloudy' },
  cloudy: { glow: '148, 163, 184', label: 'Cloudy' },
  rain: { glow: '56, 189, 248', label: 'Rain' },
  storm: { glow: '167, 139, 250', label: 'Thunderstorm' },
  snow: { glow: '186, 230, 253', label: 'Snow' },
  fog: { glow: '148, 163, 184', label: 'Fog' },
};

const Cloud: React.FC<{ fill?: string }> = ({ fill = '#e2e8f0' }) => (
  <path d="M20 46a10 10 0 0 1 1.5-19.9A14 14 0 0 1 48.6 28 9 9 0 0 1 48 46Z" fill={fill} />
);

/** Small hand-drawn SVG icons so the card needs no images and works offline. */
export const WeatherIcon: React.FC<{ condition: WeatherCondition; size?: number }> = ({ condition, size = 64 }) => {
  const sun = (cx: number, cy: number, r: number) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fbbf24" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 3)} y1={cy + Math.sin(a) * (r + 3)} x2={cx + Math.cos(a) * (r + 7)} y2={cy + Math.sin(a) * (r + 7)} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />;
      })}
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={SKY[condition].label}>
      {condition === 'sunny' && sun(32, 32, 11)}
      {condition === 'clear-night' && <path d="M40 12a20 20 0 1 0 12 34A16 16 0 0 1 40 12Z" fill="#c7d2fe" />}
      {condition === 'partly-cloudy' && <>{sun(22, 22, 8)}<g transform="translate(6 4)"><Cloud /></g></>}
      {condition === 'cloudy' && <Cloud fill="#cbd5e1" />}
      {condition === 'fog' && <><Cloud fill="#94a3b8" />{[50, 56].map(y => <line key={y} x1="14" y1={y} x2="50" y2={y} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />)}</>}
      {condition === 'rain' && <><Cloud fill="#94a3b8" />{[22, 32, 42].map(x => <line key={x} x1={x} y1="50" x2={x - 3} y2="58" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />)}</>}
      {condition === 'storm' && <><Cloud fill="#64748b" /><path d="M34 40 26 52h7l-3 10 11-14h-7l3-8Z" fill="#fde047" /></>}
      {condition === 'snow' && <><Cloud fill="#cbd5e1" />{[22, 32, 42].map(x => <circle key={x} cx={x} cy="54" r="2.6" fill="#e0f2fe" />)}</>}
    </svg>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span style={{ color: 'rgb(var(--sky))' }} aria-hidden>{icon}</span>
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>{label}</div>
      <div className="text-xs font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{value}</div>
    </div>
  </div>
);

/**
 * Weather card: true-black glass, sky-tinted glow, big temperature. Tap to
 * open the details (humidity, wind, feels-like, pressure, air quality) and the
 * forecast strip.
 */
export const WeatherVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as WeatherData;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const unit = String(d.unit ?? 'C').toUpperCase().startsWith('F') ? 'F' : 'C';
  const condition = normalizeCondition(d.condition);
  const sky = SKY[condition];
  const band = typeof d.aqi === 'number' ? aqiBand(d.aqi) : null;
  const forecast = useMemo(() => (Array.isArray(d.forecast) ? d.forecast.slice(0, 7) : []), [d.forecast]);
  const hasDetails = [d.humidity, d.wind, d.pressure, d.feelsLike, d.aqi].some(v => v !== undefined) || forecast.length > 0;

  return (
    <div
      className="my-3 rounded-3xl overflow-hidden"
      style={{
        ['--sky' as string]: sky.glow,
        background: `radial-gradient(120% 90% at 85% 0%, rgba(${sky.glow}, 0.22), transparent 60%), #000`,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 0 40px rgba(${sky.glow}, 0.10)`,
        maxWidth: 360,
      }}
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen(o => !o)}
        aria-expanded={hasDetails ? open : undefined}
        aria-controls={hasDetails ? panelId : undefined}
        className="w-full flex items-center gap-4 p-5 text-left"
        style={{ cursor: hasDetails ? 'pointer' : 'default' }}
      >
        <WeatherIcon condition={condition} />
        <div className="flex-1 min-w-0">
          <div className="text-4xl font-semibold leading-none" style={{ color: '#fff' }}>{formatTemp(d.temp, unit)}</div>
          <div className="text-xs mt-1.5 truncate" style={{ color: 'rgb(var(--sky))' }}>{d.description || sky.label}</div>
          {d.location && <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--gia-muted)' }}>{d.location}</div>}
          {(d.high !== undefined || d.low !== undefined) && (
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>
              H {formatTemp(d.high, unit)} · L {formatTemp(d.low, unit)}
            </div>
          )}
        </div>
        {hasDetails && <ChevronDown size={16} style={{ color: 'var(--gia-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} aria-hidden />}
      </button>

      {hasDetails && open && (
        <div id={panelId} className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {d.humidity !== undefined && <Stat icon={<Droplets size={15} />} label="Humidity" value={`${d.humidity}%`} />}
            {d.wind !== undefined && <Stat icon={<Wind size={15} />} label="Wind" value={`${d.wind} ${d.windUnit ?? 'km/h'}`} />}
            {d.feelsLike !== undefined && <Stat icon={<Thermometer size={15} />} label="Real feel" value={formatTemp(d.feelsLike, unit)} />}
            {d.pressure !== undefined && <Stat icon={<Gauge size={15} />} label="Pressure" value={`${d.pressure} mbar`} />}
            {d.aqi !== undefined && <Stat icon={<Leaf size={15} />} label="AQI" value={String(d.aqi)} />}
          </div>

          {band && (
            <div className="mt-3 rounded-full px-3 py-1.5 text-center text-xs font-semibold" style={{ background: `${band.color}22`, color: band.color, border: `1px solid ${band.color}55` }}>
              {band.label}
            </div>
          )}

          {forecast.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Forecast">
              {forecast.map((f, i) => (
                <div key={`${f.day}-${i}`} role="listitem" className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{f.day}</span>
                  <WeatherIcon condition={normalizeCondition(f.condition)} size={28} />
                  <span className="text-xs font-medium" style={{ color: '#fff' }}>{formatTemp(f.temp ?? f.high, unit)}</span>
                  {f.low !== undefined && <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>{formatTemp(f.low, unit)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
