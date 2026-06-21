import { logger } from '../utils/logger';
import connectionManager from './ConnectionManager';

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  labelIds: string[];
}

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function fetchGmail(path: string, options: RequestInit = {}): Promise<Response> {
  const tokens = connectionManager.getTokens('gmail');
  if (!tokens) throw new Error('Gmail not connected. Use email_connect to authenticate.');
  return fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
}

function decodeBase64(str: string): string {
  try {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return str;
  }
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { size?: number; data?: string };
  parts?: GmailPayloadPart[];
}

function parseMessagePayload(payload: GmailPayloadPart): string {
  if (payload.body?.size && payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data);
      }
      if (part.parts) {
        const nested = parseMessagePayload(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function extractHeader(headers: { name?: string; value?: string }[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

class EmailService {
  private static instance: EmailService;
  static getInstance(): EmailService {
    if (!this.instance) this.instance = new EmailService();
    return this.instance;
  }

  async send(to: string, subject: string, body: string): Promise<{ id: string }> {
    const email = [
      `From: me`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n');

    const encoded = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_');

    const res = await fetchGmail('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw: encoded }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to send email');

    logger.log(`[Email] Sent to ${to}: "${subject}"`);
    return { id: data.id };
  }

  async list(maxResults: number = 20, query?: string): Promise<GmailMessage[]> {
    const params = new URLSearchParams({
      maxResults: String(Math.min(maxResults, 50)),
      ...(query ? { q: query } : {}),
    });

    const res = await fetchGmail(`/messages?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to list emails');

    const messages = data.messages || [];
    const detailed = await Promise.all(
      messages.slice(0, maxResults).map((m: { id: string }) => this.get(m.id))
    );
    return detailed;
  }

  async get(messageId: string): Promise<GmailMessage> {
    const res = await fetchGmail(`/messages/${messageId}?format=full`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to get email');

    const headers = data.payload?.headers || [];
    return {
      id: data.id,
      threadId: data.threadId,
      from: extractHeader(headers, 'from'),
      to: extractHeader(headers, 'to'),
      subject: extractHeader(headers, 'subject'),
      snippet: data.snippet || '',
      body: parseMessagePayload(data.payload),
      date: extractHeader(headers, 'date'),
      unread: data.labelIds?.includes('UNREAD') || false,
      labelIds: data.labelIds || [],
    };
  }

  async search(query: string, maxResults: number = 10): Promise<GmailMessage[]> {
    return this.list(maxResults, query);
  }
}

export default EmailService.getInstance();
