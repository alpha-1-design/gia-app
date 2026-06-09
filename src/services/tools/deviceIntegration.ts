import { z } from 'zod';
import type { Tool } from './types';

const sendWhatsApp: Tool = {
  id: 'send_whatsapp',
  name: 'send_whatsapp',
  description: 'Send a WhatsApp message. Opens WhatsApp with a pre-filled message to a specific phone number. Includes country code required.',
  schema: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'Phone number with country code (e.g. +233501234567)' },
      message: { type: 'string', description: 'Message text to send' },
    },
    required: ['phone', 'message'],
  },
  execute: async (args) => {
    const schema = z.object({
      phone: z.string().min(5).max(20).describe('Phone number with country code'),
      message: z.string().min(1).max(5000).describe('Message text'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      const result = await di.sendWhatsApp(parsed.data.phone, parsed.data.message);
      const methodBadge = result.method === 'capacitor_share' ? '🔄 Native Share' : '🔗 wa.me Link';
      return {
        success: true,
        content: `## ✅ WhatsApp Message\n\n**To:** \`${parsed.data.phone}\`\n**Method:** ${methodBadge}\n\n**Message:**\n> ${parsed.data.message.slice(0, 300)}${parsed.data.message.length > 300 ? '…' : ''}\n\n*WhatsApp opened with pre-filled message — tap send to deliver.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const sendEmail: Tool = {
  id: 'send_email',
  name: 'send_email',
  description: 'Compose an email. Opens the device email client with pre-filled recipient, subject, and body.',
  schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body text' },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (args) => {
    const schema = z.object({
      to: z.string().email('Must be a valid email address'),
      subject: z.string().min(1).max(500),
      body: z.string().min(1).max(50000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      await di.sendEmail(parsed.data.to, parsed.data.subject, parsed.data.body);
      return {
        success: true,
        content: `## ✉️ Email Composed\n\n**To:** \`${parsed.data.to}\`\n**Subject:** *${parsed.data.subject}*\n\n**Body:**\n> ${parsed.data.body.slice(0, 300)}${parsed.data.body.length > 300 ? '…' : ''}\n\n*Email client opened with pre-filled fields — tap send to deliver.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const sendSMS: Tool = {
  id: 'send_sms',
  name: 'send_sms',
  description: 'Send an SMS text message. Opens the default SMS app with a pre-filled message and recipient.',
  schema: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'Recipient phone number' },
      message: { type: 'string', description: 'SMS text content' },
    },
    required: ['phone', 'message'],
  },
  execute: async (args) => {
    const schema = z.object({
      phone: z.string().min(5).max(20),
      message: z.string().min(1).max(1000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      await di.sendSMS(parsed.data.phone, parsed.data.message);
      return {
        success: true,
        content: `## 💬 SMS Composed\n\n**To:** \`${parsed.data.phone}\`\n\n**Message:**\n> ${parsed.data.message.slice(0, 300)}${parsed.data.message.length > 300 ? '…' : ''}\n\n*SMS app opened with pre-filled message — tap send.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const makeCall: Tool = {
  id: 'make_phone_call',
  name: 'make_phone_call',
  description: 'Initiate a phone call. Opens the phone dialer with the specified number pre-filled. The user must press the call button.',
  schema: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: 'Phone number to call (with country code, e.g. +233501234567)' },
    },
    required: ['phone'],
  },
  execute: async (args) => {
    const schema = z.object({
      phone: z.string().min(5).max(20),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      const result = await di.makeCall(parsed.data.phone);
      return {
        success: true,
        content: `## 📞 Phone Call Initiated\n\n**Number:** \`${parsed.data.phone}\`\n**Method:** ${result.method === 'tel_link' ? '🔗 Phone Dialer' : '📱 Native'}\n\n*Phone dialer opened with the number pre-filled. Press the call button to connect.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const shareContent: Tool = {
  id: 'share',
  name: 'share',
  description: 'Share content to any app using the native share sheet. Supports text, URLs, and titles. Falls back to clipboard copy if share not available.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Share title' },
      text: { type: 'string', description: 'Share text content' },
      url: { type: 'string', description: 'Optional URL to share' },
    },
    required: ['title', 'text'],
  },
  execute: async (args) => {
    const schema = z.object({
      title: z.string().min(1).max(500),
      text: z.string().min(1).max(10000),
      url: z.string().url().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      const result = await di.shareContent(parsed.data.title, parsed.data.text, parsed.data.url);
      const methodLabels: Record<string, string> = {
        capacitor_share: '🔄 Native Share Sheet',
        web_share_api: '🌐 Web Share API',
        clipboard_fallback: '📋 Copied to Clipboard',
      };
      return {
        success: true,
        content: `## 🔗 Shared\n\n**Title:** ${parsed.data.title}\n**Method:** ${methodLabels[result.method] || result.method}\n\n**Content:**\n> ${parsed.data.text.slice(0, 300)}${parsed.data.text.length > 300 ? '…' : ''}${parsed.data.url ? `\n> ${parsed.data.url}` : ''}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const clipboardTool: Tool = {
  id: 'clipboard',
  name: 'clipboard',
  description: 'Read from or write to the system clipboard. Supports both reading current clipboard content and writing new text.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write'], description: 'read or write to clipboard' },
      text: { type: 'string', description: 'Text to write (required if action is "write")' },
    },
    required: ['action'],
  },
  execute: async (args) => {
    const schema = z.object({
      action: z.enum(['read', 'write']),
      text: z.string().max(50000).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { action, text } = parsed.data;
    try {
      const di = (await import('../DeviceIntegration')).default;
      if (action === 'read') {
        const content = await di.clipboardRead();
        return {
          success: true,
          content: `## 📋 Clipboard Contents\n\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\`\n\n*Read from system clipboard.*`,
        };
      } else {
        if (!text) return { success: false, content: '', error: 'text is required for write action' };
        await di.clipboardWrite(text);
        return {
          success: true,
          content: `## ✏️ Copied to Clipboard\n\n\`\`\`\n${text.slice(0, 500)}${text.length > 500 ? '…' : ''}\n\`\`\`\n\n*Written to system clipboard — ready to paste anywhere.*`,
        };
      }
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const vibrateTool: Tool = {
  id: 'vibrate',
  name: 'vibrate',
  description: 'Trigger device vibration/haptic feedback. Uses native haptics on mobile (light/medium/heavy) and Vibration API on web.',
  schema: {
    type: 'object',
    properties: {
      duration: { type: 'number', description: 'Vibration duration in milliseconds (100-5000). <500=light tap, <1000=medium, 1000+=heavy pulse' },
    },
    required: ['duration'],
  },
  execute: async (args) => {
    const schema = z.object({
      duration: z.number().min(100).max(5000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      const result = await di.vibrate(parsed.data.duration);
      const hapticLabels: Record<string, string> = {
        capacitor_haptics: '📱 Native Haptics',
        vibration_api: '📳 Vibration API',
      };
      return {
        success: true,
        content: `## 📳 Device Vibrated\n\n**Duration:** ${parsed.data.duration}ms\n**Method:** ${hapticLabels[result.method] || result.method}\n\n*Haptic feedback triggered.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const brightnessTool: Tool = {
  id: 'screen_brightness',
  name: 'screen_brightness',
  description: 'Get or set device screen brightness. Value range: 0.0 (minimum brightness) to 1.0 (maximum brightness). Native Android only.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['get', 'set'], description: 'get current brightness or set to a specific value' },
      value: { type: 'number', description: 'Brightness level 0.0 to 1.0 (required if action is "set")' },
    },
    required: ['action'],
  },
  execute: async (args) => {
    const schema = z.object({
      action: z.enum(['get', 'set']),
      value: z.number().min(0).max(1).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    const { action, value } = parsed.data;
    try {
      const di = (await import('../DeviceIntegration')).default;
      if (action === 'get') {
        const brightness = await di.getBrightness();
        const pct = Math.round(brightness * 100);
        const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        return {
          success: true,
          content: `## ☀️ Screen Brightness\n\n**Current:** ${pct}%\n\n\`${bar}\`\n\nRange: 0% (minimum) → 100% (maximum)`,
        };
      } else {
        if (value === undefined) return { success: false, content: '', error: 'value is required for set action' };
        await di.setBrightness(value);
        const pct = Math.round(value * 100);
        return {
          success: true,
          content: `## ☀️ Brightness Adjusted\n\n**Set to:** ${pct}%\n\n*Screen brightness updated.*`,
        };
      }
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const deviceInfoTool: Tool = {
  id: 'device_info',
  name: 'device_info',
  description: 'Get comprehensive device and system information: OS, hardware specs, battery status, network connectivity, display, language, timezone.',
  schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const di = (await import('../DeviceIntegration')).default;
      const info = await di.getDeviceInfo();
      return { success: true, content: di.formatDeviceInfo(info) };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const contactsTool: Tool = {
  id: 'get_contacts',
  name: 'get_contacts',
  description: 'Search or list contacts from the device address book. Requires contacts permission on mobile. Supports searching by name, phone, or email.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional search query — matches name, phone number, or email' },
      maxResults: { type: 'number', description: 'Maximum results to return (default: 20, max: 100)' },
    },
    required: [],
  },
  execute: async (args) => {
    const schema = z.object({
      query: z.string().max(200).optional(),
      maxResults: z.number().min(1).max(100).default(20),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      const contacts = await di.getContacts(parsed.data.query);
      const max = parsed.data.maxResults;
      const selected = contacts.slice(0, max);
      if (selected.length === 0) return { success: true, content: 'No contacts found.' };
      const summary = `Found ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}${parsed.data.query ? ` matching "${parsed.data.query}"` : ''}.`;
      const lines = selected.map((c, i) => {
        const phones = c.phones.map(p => `  📞 **${p.label || 'Phone'}:** \`${p.number}\``).join('\n');
        const emails = c.emails.map(e => `  ✉️ **${e.label || 'Email'}:** \`${e.address}\``).join('\n');
        return `### ${i + 1}. ${c.name}\n${phones}${emails ? '\n' + emails : ''}`;
      });
      const footer = contacts.length > max ? `\n\n_Showing ${max} of ${contacts.length} contacts. Use \`maxResults\` to see more._` : '';
      return {
        success: true,
        content: `## 👤 Contacts\n\n${summary}\n\n${lines.join('\n\n')}${footer}`,
        sources: selected.map(c => ({ title: c.name, url: c.phones[0]?.number || '' })),
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const openUrlTool: Tool = {
  id: 'open_url',
  name: 'open_url',
  description: 'Open a URL in the default system browser or external app. Can open web links, deep links, and app URIs.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to open (https://, tel:, mailto:, or custom scheme)' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const schema = z.object({
      url: z.string().min(1).max(5000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    try {
      const di = (await import('../DeviceIntegration')).default;
      await di.openUrl(parsed.data.url);
      const domain = (() => { try { return new URL(parsed.data.url).hostname; } catch { return parsed.data.url; } })();
      return {
        success: true,
        content: `## 🔗 URL Opened\n\n**URL:** [${parsed.data.url}](${parsed.data.url})\n**Domain:** \`${domain}\`\n\n*Opened in default browser.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const deviceIntegrationTools: Tool[] = [
  sendWhatsApp,
  sendEmail,
  sendSMS,
  makeCall,
  shareContent,
  clipboardTool,
  vibrateTool,
  brightnessTool,
  deviceInfoTool,
  contactsTool,
  openUrlTool,
];
