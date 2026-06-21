import { z } from 'zod';
import type { Tool } from './types';
import emailService from '../EmailService';
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

const emailConnect: Tool = {
  id: 'email_connect',
  name: 'email_connect',
  description: 'Connect your Gmail account via OAuth. Opens a popup to authorize GIA to send and read emails.',
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

    const result = await connectionManager.connect('gmail', parsed.data.clientId);
    if (!result.success) {
      return { success: false, content: '', error: result.error || 'Gmail connection failed' };
    }
    return { success: true, content: '✅ Gmail connected successfully! You can now send and read emails using GIA.' };
  },
};

const emailDisconnect: Tool = {
  id: 'email_disconnect',
  name: 'email_disconnect',
  description: 'Disconnect Gmail and remove stored tokens.',
  execute: async () => {
    await connectionManager.disconnect('gmail');
    return { success: true, content: '🔌 Gmail disconnected. Tokens removed.' };
  },
};

const emailStatus: Tool = {
  id: 'email_status',
  name: 'email_status',
  description: 'Check if Gmail is connected and show account info.',
  execute: async () => {
    const connected = connectionManager.isConnected('gmail');
    const account = connectionManager.getAccountName('gmail');
    return {
      success: true,
      content: connected
        ? `✅ Gmail is connected${account ? ` (${account})` : ''}`
        : '❌ Gmail is not connected. Use `email_connect` with your Google Cloud client ID to authenticate.',
    };
  },
};

const emailSend: Tool = {
  id: 'email_send',
  name: 'email_send',
  description: 'Send an email via your connected Gmail account.',
  schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body content (plain text)' },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (args) => {
    const schema = z.object({
      to: z.string().email('Must be a valid email address'),
      subject: z.string().min(1, 'Subject is required').max(500),
      body: z.string().min(1, 'Body is required').max(100000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const result = await emailService.send(parsed.data.to, parsed.data.subject, parsed.data.body);
      return {
        success: true,
        content: `## ✅ Email Sent\n\n**To:** ${parsed.data.to}\n**Subject:** ${parsed.data.subject}\n**Gmail ID:** \`${result.id}\``,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to send email' };
    }
  },
};

const emailList: Tool = {
  id: 'email_list',
  name: 'email_list',
  description: 'List recent emails from your Gmail inbox.',
  schema: {
    type: 'object',
    properties: {
      maxResults: { type: 'number', description: 'Number of emails to fetch (default: 10, max: 50)' },
      query: { type: 'string', description: 'Optional search query (e.g. "from:someone@example.com" or "subject:meeting")' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      maxResults: z.number().min(1).max(50).optional().default(10),
      query: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const messages = await emailService.list(parsed.data.maxResults, parsed.data.query);
      if (messages.length === 0) {
        return { success: true, content: '📭 No emails found.' };
      }

      const lines = messages.map(m => {
        const icon = m.unread ? '🔴' : '✅';
        const snippet = m.snippet.slice(0, 120);
        return `${icon} **From:** ${m.from}\n   **Subject:** ${m.subject}\n   **Date:** ${m.date}\n   > ${snippet}\n   \`${m.id}\``;
      });

      return {
        success: true,
        content: `## 📬 Inbox (${messages.length})\n\n${lines.join('\n\n')}\n\nUse \`email_read\` with an email ID to see full content.`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to list emails' };
    }
  },
};

const emailRead: Tool = {
  id: 'email_read',
  name: 'email_read',
  description: 'Read the full content of a specific email by its Gmail message ID. Get IDs from email_list.',
  schema: {
    type: 'object',
    properties: {
      messageId: { type: 'string', description: 'The Gmail message ID (from email_list)' },
    },
    required: ['messageId'],
  },
  execute: async (args) => {
    const schema = z.object({ messageId: z.string().min(1, 'Message ID is required') });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const msg = await emailService.get(parsed.data.messageId);
      return {
        success: true,
        content: `## 📨 Email\n\n**From:** ${msg.from}\n**To:** ${msg.to}\n**Subject:** ${msg.subject}\n**Date:** ${msg.date}\n**Status:** ${msg.unread ? '🔴 Unread' : '✅ Read'}\n\n${msg.body.slice(0, 10000)}${msg.body.length > 10000 ? '\n\n*(truncated)*' : ''}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to read email' };
    }
  },
};

const emailSearch: Tool = {
  id: 'email_search',
  name: 'email_search',
  description: 'Search emails using Gmail search syntax (e.g. "from:john", "subject:invoice", "has:attachment").',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query. Examples: "from:alice", "subject:meeting", "has:attachment", "after:2024/01/01"' },
      maxResults: { type: 'number', description: 'Maximum results (default: 10, max: 50)' },
    },
    required: ['query'],
  },
  execute: async (args) => {
    const schema = z.object({
      query: z.string().min(1, 'Search query is required'),
      maxResults: z.number().min(1).max(50).optional().default(10),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    try {
      const messages = await emailService.search(parsed.data.query, parsed.data.maxResults);
      if (messages.length === 0) {
        return { success: true, content: `No emails found matching query: "${parsed.data.query}"` };
      }
      const lines = messages.map(m => {
        const snippet = m.snippet.slice(0, 120);
        return `**From:** ${m.from}\n**Subject:** ${m.subject}\n**Date:** ${m.date}\n> ${snippet}\n\`${m.id}\``;
      });
      return {
        success: true,
        content: `## 🔍 Search Results: "${parsed.data.query}" (${messages.length})\n\n${lines.join('\n\n')}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Search failed' };
    }
  },
};

export const emailTools: Tool[] = [
  emailConnect,
  emailDisconnect,
  emailStatus,
  emailSend,
  emailList,
  emailRead,
  emailSearch,
];
