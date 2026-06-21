import { logger } from '../utils/logger';
import connectionManager from './ConnectionManager';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status: string;
  htmlLink?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  recurrence?: string[];
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
}

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';

async function fetchCalendar(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = connectionManager.getTokens('calendar');
  if (!tokens) throw new Error('Calendar not connected. Use calendar_connect to authenticate.');
  return fetch(`${CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

class CalendarService {
  private static instance: CalendarService;
  static getInstance(): CalendarService {
    if (!this.instance) this.instance = new CalendarService();
    return this.instance;
  }

  async listEvents(
    maxResults: number = 20,
    timeMin?: string,
    timeMax?: string,
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      maxResults: String(Math.min(maxResults, 100)),
      orderBy: 'startTime',
      singleEvents: 'true',
      ...(timeMin ? { timeMin } : { timeMin: new Date().toISOString() }),
      ...(timeMax ? { timeMax } : {}),
    });

    const res = await fetchCalendar(`/events?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to list events');

    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || '(No title)',
      description: item.description,
      location: item.location,
      start: item.start,
      end: item.end,
      status: item.status || 'confirmed',
      htmlLink: item.htmlLink,
      attendees: item.attendees,
      recurrence: item.recurrence,
    }));
  }

  async createEvent(event: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
    reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  }): Promise<CalendarEvent> {
    const body = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
      reminders: event.reminders ?? { useDefault: true },
    };

    const res = await fetchCalendar('/events', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to create event');

    logger.log(`[Calendar] Created event: "${event.summary}"`);
    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
      status: data.status,
      htmlLink: data.htmlLink,
      attendees: data.attendees,
      recurrence: data.recurrence,
    };
  }

  async updateEvent(
    eventId: string,
    updates: {
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime: string; timeZone?: string };
      end?: { dateTime: string; timeZone?: string };
      attendees?: { email: string }[];
    },
  ): Promise<CalendarEvent> {
    const res = await fetchCalendar(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update event');

    logger.log(`[Calendar] Updated event: "${data.summary || eventId}"`);
    return {
      id: data.id,
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
      status: data.status,
      htmlLink: data.htmlLink,
      attendees: data.attendees,
      recurrence: data.recurrence,
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    const res = await fetchCalendar(`/events/${eventId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Failed to delete event');
    }
    logger.log(`[Calendar] Deleted event: ${eventId}`);
  }

  async getEvent(eventId: string): Promise<CalendarEvent> {
    const res = await fetchCalendar(`/events/${eventId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to get event');
    return {
      id: data.id,
      summary: data.summary || '(No title)',
      description: data.description,
      location: data.location,
      start: data.start,
      end: data.end,
      status: data.status,
      htmlLink: data.htmlLink,
      attendees: data.attendees,
      recurrence: data.recurrence,
    };
  }
}

export default CalendarService.getInstance();
