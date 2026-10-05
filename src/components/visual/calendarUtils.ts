export interface CalendarEvent {
  title: string;
  /** ISO date or date-time. Date-only strings are treated as all-day. */
  start: string;
  end?: string;
  location?: string;
  color?: string;
  allDay?: boolean;
}

export interface DayBucket {
  key: string;        // YYYY-MM-DD
  date: Date;
  events: CalendarEvent[];
}

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Date-only strings ("2026-10-09") are local dates, not UTC midnights. */
export function parseWhen(value: string): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isAllDay(e: CalendarEvent): boolean {
  return e.allDay === true || /^\d{4}-\d{2}-\d{2}$/.test(e.start);
}

/**
 * Groups events by day and returns a contiguous run of days so empty days
 * still show up on the strip. Bad dates are dropped; events sort by start time.
 */
export function bucketEvents(events: CalendarEvent[], maxDays = 14): DayBucket[] {
  const map = new Map<string, DayBucket>();
  for (const e of events) {
    const d = parseWhen(e.start);
    if (!d) continue;
    const key = dayKey(d);
    const bucket = map.get(key) ?? { key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), events: [] };
    bucket.events.push(e);
    map.set(key, bucket);
  }
  const days = [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (days.length === 0) return [];

  const out: DayBucket[] = [];
  const cursor = new Date(days[0].date);
  const last = days[days.length - 1].date;
  while (cursor <= last && out.length < maxDays) {
    const key = dayKey(cursor);
    const existing = map.get(key);
    out.push(existing ?? { key, date: new Date(cursor), events: [] });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const b of out) {
    b.events.sort((x, y) => (parseWhen(x.start)?.getTime() ?? 0) - (parseWhen(y.start)?.getTime() ?? 0));
  }
  return out;
}

export function formatTime(e: CalendarEvent): string {
  if (isAllDay(e)) return 'All day';
  const d = parseWhen(e.start);
  if (!d) return '';
  const fmt = (x: Date) => x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = e.end ? parseWhen(e.end) : null;
  return end ? `${fmt(d)} – ${fmt(end)}` : fmt(d);
}
