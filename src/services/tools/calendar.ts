import { z } from 'zod';
import type { Tool } from './types';
import calendarService from '../CalendarService';
import connectionManager from '../ConnectionManager';

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    return i.message;
  }).join('; ');
}

const calendarConnect: Tool = {
  id: 'calendar_connect',
  name: 'calendar_connect',
  description: 'Connect your Google Calendar via OAuth. Opens a popup to authorize GIA to read and manage your events.',
  schema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'Your Google Cloud OAuth client ID (web application type)' },
    },
    required: ['clientId'],
  },
  execute: async (args) => {
    const schema = z.object({ clientId: z.string().min(1, 'Client ID is required') });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const result = await connectionManager.connect('calendar', parsed.data.clientId);
    if (!result.success) {
      return { success: false, content: '', error: result.error || 'Calendar connection failed' };
    }
    return { success: true, content: '✅ Google Calendar connected successfully! You can now manage events using GIA.' };
  },
};

const calendarDisconnect: Tool = {
  id: 'calendar_disconnect',
  name: 'calendar_disconnect',
  description: 'Disconnect Google Calendar and remove stored tokens.',
  execute: async () => {
    await connectionManager.disconnect('calendar');
    return { success: true, content: '🔌 Google Calendar disconnected. Tokens removed.' };
  },
};

const calendarStatus: Tool = {
  id: 'calendar_status',
  name: 'calendar_status',
  description: 'Check if Google Calendar is connected.',
  execute: async () => {
    const connected = connectionManager.isConnected('calendar');
    return {
      success: true,
      content: connected
        ? '✅ Google Calendar is connected'
        : '❌ Google Calendar is not connected. Use `calendar_connect` with your Google Cloud client ID to authenticate.',
    };
  },
};

const calendarListEvents: Tool = {
  id: 'calendar_list_events',
  name: 'calendar_list_events',
  description: 'List upcoming events from your Google Calendar.',
  schema: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: 'Number of events to fetch (default: 20, max: 100)' },
      timeMin: { type: 'string', description: 'Start of time range in ISO 8601 (default: now). Example: "2025-01-01T00:00:00Z"' },
      timeMax: { type: 'string', description: 'End of time range in ISO 8601. Example: "2025-12-31T23:59:59Z"' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      maxResults: z.number().min(1).max(100).optional().default(20),
      timeMin: z.string().optional(),
      timeMax: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const events = await calendarService.listEvents(
        parsed.data.maxResults,
        parsed.data.timeMin,
        parsed.data.timeMax,
      );
      if (events.length === 0) {
        return { success: true, content: '📅 No upcoming events found.' };
      }

      const lines = events.map((e, i) => {
        const start = e.start?.dateTime || e.start?.date || 'TBD';
        const end = e.end?.dateTime || e.end?.date || '';
        const time = end ? `${new Date(start).toLocaleString()} — ${new Date(end).toLocaleString()}` : new Date(start).toLocaleString();
        return `${i + 1}. **${e.summary}**\n   🕐 ${time}\n   ${e.location ? `📍 ${e.location}\n   ` : ''}${e.description ? `> ${e.description.slice(0, 200)}` : ''}${e.htmlLink ? `\n   🔗 ${e.htmlLink}` : ''}`;
      });

      return {
        success: true,
        content: `## 📅 Upcoming Events (${events.length})\n\n${lines.join('\n\n')}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to list events' };
    }
  },
};

const calendarCreateEvent: Tool = {
  id: 'calendar_create_event',
  name: 'calendar_create_event',
  description: 'Create a new event on your Google Calendar.',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Event title' },
      description: { type: 'string', description: 'Optional event description or notes' },
      location: { type: 'string', description: 'Optional event location (address or place name)' },
      startDateTime: { type: 'string', description: 'Start time in ISO 8601 format. Example: "2025-03-15T09:00:00+00:00"' },
      endDateTime: { type: 'string', description: 'End time in ISO 8601 format. Example: "2025-03-15T10:00:00+00:00"' },
      timeZone: { type: 'string', description: 'Optional timezone (default: UTC). Example: "Africa/Accra"' },
      attendees: { type: 'array', items: { type: 'string' }, description: 'Optional list of attendee email addresses' },
    },
    required: ['summary', 'startDateTime', 'endDateTime'],
  },
  execute: async (args) => {
    const schema = z.object({
      summary: z.string().min(1, 'Event title is required').max(500),
      description: z.string().max(5000).optional(),
      location: z.string().max(500).optional(),
      startDateTime: z.string().min(1, 'Start time is required'),
      endDateTime: z.string().min(1, 'End time is required'),
      timeZone: z.string().optional().default('UTC'),
      attendees: z.array(z.string().email()).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const event = await calendarService.createEvent({
        summary: parsed.data.summary,
        description: parsed.data.description,
        location: parsed.data.location,
        start: { dateTime: parsed.data.startDateTime, timeZone: parsed.data.timeZone },
        end: { dateTime: parsed.data.endDateTime, timeZone: parsed.data.timeZone },
        attendees: parsed.data.attendees?.map(email => ({ email })),
      });

      return {
        success: true,
        content: `## ✅ Event Created\n\n**${event.summary}**\n🕐 ${event.start.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'All day'} — ${event.end.dateTime ? new Date(event.end.dateTime).toLocaleString() : 'All day'}${event.location ? `\n📍 ${event.location}` : ''}${event.htmlLink ? `\n🔗 ${event.htmlLink}` : ''}\n\n**Google Calendar ID:** \`${event.id}\``,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to create event' };
    }
  },
};

const calendarUpdateEvent: Tool = {
  id: 'calendar_update_event',
  name: 'calendar_update_event',
  description: 'Update an existing calendar event (title, time, description, etc.). Find event IDs using calendar_list_events.',
  schema: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'The Google Calendar event ID to update' },
      summary: { type: 'string', description: 'New event title' },
      description: { type: 'string', description: 'New description' },
      location: { type: 'string', description: 'New location' },
      startDateTime: { type: 'string', description: 'New start time in ISO 8601' },
      endDateTime: { type: 'string', description: 'New end time in ISO 8601' },
      timeZone: { type: 'string', description: 'Timezone for the event' },
    },
    required: ['eventId'],
  },
  execute: async (args) => {
    const schema = z.object({
      eventId: z.string().min(1, 'Event ID is required'),
      summary: z.string().max(500).optional(),
      description: z.string().max(5000).optional(),
      location: z.string().max(500).optional(),
      startDateTime: z.string().optional(),
      endDateTime: z.string().optional(),
      timeZone: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const updates: Record<string, unknown> = {};
      if (parsed.data.summary) updates.summary = parsed.data.summary;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.location !== undefined) updates.location = parsed.data.location;
      if (parsed.data.startDateTime) {
        updates.start = { dateTime: parsed.data.startDateTime, timeZone: parsed.data.timeZone || 'UTC' };
      }
      if (parsed.data.endDateTime) {
        updates.end = { dateTime: parsed.data.endDateTime, timeZone: parsed.data.timeZone || 'UTC' };
      }

      const event = await calendarService.updateEvent(parsed.data.eventId, updates);

      return {
        success: true,
        content: `## ✅ Event Updated\n\n**${event.summary}**\n🕐 ${event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 'TBD'}${event.htmlLink ? `\n🔗 ${event.htmlLink}` : ''}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to update event' };
    }
  },
};

const calendarDeleteEvent: Tool = {
  id: 'calendar_delete_event',
  name: 'calendar_delete_event',
  description: 'Delete a calendar event by its ID. Use calendar_list_events to find event IDs.',
  schema: {
    type: 'object',
    properties: {
      eventId: { type: 'string', description: 'The Google Calendar event ID to delete' },
    },
    required: ['eventId'],
  },
  execute: async (args) => {
    const schema = z.object({ eventId: z.string().min(1, 'Event ID is required') });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      await calendarService.deleteEvent(parsed.data.eventId);
      return { success: true, content: `🗑️ Event \`${parsed.data.eventId}\` deleted.` };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to delete event' };
    }
  },
};

export const calendarTools: Tool[] = [
  calendarConnect,
  calendarDisconnect,
  calendarStatus,
  calendarListEvents,
  calendarCreateEvent,
  calendarUpdateEvent,
  calendarDeleteEvent,
];
