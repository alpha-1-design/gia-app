import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, MapPin, Clock } from 'lucide-react';
import { bucketEvents, dayKey, formatTime, type CalendarEvent } from './calendarUtils';

interface CalendarData {
  title?: string;
  events?: CalendarEvent[];
}

const PALETTE = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'];

/**
 * Day-strip calendar: swipe along the week, tap a day, see that day's events.
 * Starts on today if it has events, otherwise on the first day that does.
 */
export const CalendarVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as CalendarData;
  const days = useMemo(() => bucketEvents(Array.isArray(d.events) ? d.events : []), [d.events]);
  const todayKey = dayKey(new Date());

  const initial = useMemo(() => {
    const today = days.find(x => x.key === todayKey && x.events.length > 0);
    return (today ?? days.find(x => x.events.length > 0) ?? days[0])?.key ?? '';
  }, [days, todayKey]);
  const [selected, setSelected] = useState(initial);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelected(initial); }, [initial]);

  // Keep the selected day in view on the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [selected]);

  if (days.length === 0) {
    return (
      <div className="my-3 rounded-3xl p-5 text-sm flex items-center gap-3" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--gia-muted)', maxWidth: 380 }}>
        <CalendarDays size={18} aria-hidden /> Nothing on the calendar for this period.
      </div>
    );
  }

  const active = days.find(x => x.key === selected) ?? days[0];
  const total = days.reduce((n, x) => n + x.events.length, 0);
  const monthLabel = active.date.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="my-3 rounded-3xl overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 0% 0%, rgba(34,211,238,0.12), transparent 55%), #000', border: '1px solid rgba(255,255,255,0.08)', maxWidth: 380 }}>
      <div className="px-5 pt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight" style={{ color: '#fff' }}>{d.title || 'Upcoming'}</div>
          <div className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--gia-muted)' }}>
            <CalendarDays size={12} aria-hidden /> {total} {total === 1 ? 'event' : 'events'}
          </div>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-text)' }}>{monthLabel}</span>
      </div>

      <div ref={stripRef} role="group" aria-label="Days" className="flex gap-2 overflow-x-auto px-5 py-4" style={{ scrollbarWidth: 'none' }}>
        {days.map(day => {
          const isActive = day.key === active.key;
          const isToday = day.key === todayKey;
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={isActive}
              aria-label={`${day.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}, ${day.events.length} events`}
              onClick={() => setSelected(day.key)}
              className="flex flex-col items-center shrink-0 rounded-2xl px-3 py-2 min-w-[46px]"
              style={{
                background: isActive ? '#22d3ee' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#000' : 'var(--gia-text)',
                border: isToday && !isActive ? '1px solid rgba(34,211,238,0.6)' : '1px solid transparent',
              }}
            >
              <span className="text-base font-semibold leading-none">{day.date.getDate()}</span>
              <span className="text-[10px] mt-1" style={{ opacity: isActive ? 0.8 : 0.6 }}>{day.date.toLocaleDateString([], { weekday: 'short' })}</span>
              <span className="flex gap-0.5 mt-1.5 h-1" aria-hidden>
                {day.events.slice(0, 3).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full" style={{ background: isActive ? '#000' : '#22d3ee' }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-5 flex flex-col gap-2" role="list" aria-label={`Events on ${active.date.toLocaleDateString()}`}>
        {active.events.length === 0 ? (
          <div className="text-xs py-2" style={{ color: 'var(--gia-muted)' }}>Free day. Nothing scheduled.</div>
        ) : active.events.map((e, i) => {
          const color = e.color || PALETTE[i % PALETTE.length];
          return (
            <div key={`${e.title}-${i}`} role="listitem" className="rounded-2xl p-3 flex gap-3" style={{ background: 'rgba(255,255,255,0.05)', borderLeft: `3px solid ${color}` }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: '#fff' }}>{e.title}</div>
                <div className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--gia-muted)' }}>
                  <Clock size={11} aria-hidden /> {formatTime(e)}
                </div>
                {e.location && (
                  <div className="text-[11px] mt-0.5 flex items-center gap-1.5 min-w-0" style={{ color: 'var(--gia-muted)' }}>
                    <MapPin size={11} aria-hidden className="shrink-0" /> <span className="truncate">{e.location}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
