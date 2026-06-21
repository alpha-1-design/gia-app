import { z } from 'zod';
import type { Tool } from './types';
import messagingBridge from '../MessagingBridge';

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

const messagingStatus: Tool = {
  id: 'messaging_status',
  name: 'messaging_status',
  description: 'Check the status of messaging channels (Telegram/WhatsApp). Shows which channels are connected, whether polling is active, and mention mode.',
  execute: async () => {
    const channels = messagingBridge.getChannels();
    if (channels.length === 0) {
      return {
        success: true,
        content: '## 📱 Messaging Channels\n\nNo channels configured.\n\n**Setup options:**\n- `messaging_setup_telegram` — Connect a Telegram bot for two-way chat\n- `messaging_setup_whatsapp` — Set up WhatsApp notifications',
      };
    }

    const lines = channels.map(ch => {
      const details = Object.entries(ch.config).map(([k, v]) => `  ${k}: ${v}`).join('\n');
      const mentionInfo = ch.type === 'telegram' ? `  mentionOnly: ${messagingBridge.isMentionOnly()}` : '';
      return `- **${ch.label}** ${ch.connected ? '✅ Connected' : '❌ Disconnected'}\n${details}${mentionInfo}`;
    });

    const polling = messagingBridge.isPolling();
    return {
      success: true,
      content: `## 📱 Messaging Channels\n\n${lines.join('\n\n')}\n\n**Polling:** ${polling ? '🟢 Active' : '⚫ Inactive'}\n\nEnable **Long-Running Mode** in Settings for continuous message polling.\n\nUse \`messaging_set_mention_only\` to control whether GIA responds to all group messages or only when @mentioned.`,
    };
  },
};

const messagingSetupTelegram: Tool = {
  id: 'messaging_setup_telegram',
  name: 'messaging_setup_telegram',
  description: 'Connect your Telegram bot so GIA can join group chats and DMs. Add the bot to any group as an admin, then GIA will see messages and respond. Get a bot token from @BotFather on Telegram.',
  schema: {
    type: 'object',
    properties: {
      botToken: { type: 'string', description: 'Bot token from @BotFather (e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)' },
    },
    required: ['botToken'],
  },
  execute: async (args) => {
    const schema = z.object({ botToken: z.string().min(1, 'Bot token is required') });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const result = await messagingBridge.configureTelegram(parsed.data.botToken);
    if (!result.success) return { success: false, content: '', error: result.error || 'Failed to connect Telegram' };

    if (messagingBridge.isPolling()) {
      messagingBridge.stopPolling();
    }
    messagingBridge.startPolling();

    return {
      success: true,
      content: `## ✅ Telegram Bot Connected\n\nYour bot is active! Here's how to use it:\n\n**1. Private Chat** — Just message your bot on Telegram. GIA will reply directly.\n\n**2. Group Chat** — Add the bot to any Telegram group. Use \`messaging_set_mention_only\` to control whether GIA responds to all messages or only when @mentioned.\n\n**3. Proactive Updates** — GIA can message you when long tasks complete or need attention.\n\n**Important:** Enable **Long-Running Mode** in Settings → Power & Background so the bot keeps polling even when the tab is in the background.\n\nTry sending a message to your bot now!`,
    };
  },
};

const messagingSetupWhatsApp: Tool = {
  id: 'messaging_setup_whatsapp',
  name: 'messaging_setup_whatsapp',
  description: 'Configure WhatsApp for GIA notifications (one-way only). GIA can prepare messages that open in WhatsApp via wa.me links — you tap to send. For full two-way chat, use Telegram.',
  schema: {
    type: 'object',
    properties: {
      phoneNumber: { type: 'string', description: 'Your phone number in international format (e.g. +233501234567)' },
    },
    required: ['phoneNumber'],
  },
  execute: async (args) => {
    const schema = z.object({
      phoneNumber: z.string().min(5, 'Phone number is required').max(20),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    messagingBridge.configureWhatsApp(parsed.data.phoneNumber);
    return {
      success: true,
      content: `## ✅ WhatsApp Configured\n\n**Number:** ${parsed.data.phoneNumber}\n\nGIA can now prepare messages for WhatsApp. When she sends one, a wa.me link will appear — tap it to open WhatsApp and tap send.\n\n**Limitation:** This is one-way only (GIA → You). For full two-way chat with @mentions and groups, use \`messaging_setup_telegram\` instead.\n\n*Full two-way WhatsApp needs the Business API (paid) or a Node.js sidecar.*`,
    };
  },
};

const messagingDisconnect: Tool = {
  id: 'messaging_disconnect',
  name: 'messaging_disconnect',
  description: 'Disconnect a messaging channel (telegram or whatsapp).',
  schema: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: ['telegram', 'whatsapp'], description: 'Channel to disconnect' },
    },
    required: ['channel'],
  },
  execute: async (args) => {
    const schema = z.object({ channel: z.enum(['telegram', 'whatsapp']) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    messagingBridge.disconnect(parsed.data.channel);
    if (parsed.data.channel === 'telegram') {
      messagingBridge.stopPolling();
    }

    return {
      success: true,
      content: `🔌 ${parsed.data.channel === 'telegram' ? 'Telegram bot' : 'WhatsApp'} disconnected.`,
    };
  },
};

const messagingSend: Tool = {
  id: 'messaging_send',
  name: 'messaging_send',
  description: 'Send a proactive message to the user on a connected messaging channel. Use this to notify the user about important updates, reminders, or results.',
  schema: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: ['telegram', 'whatsapp'], description: 'Channel to send the message through' },
      message: { type: 'string', description: 'The message text to send' },
    },
    required: ['channel', 'message'],
  },
  execute: async (args) => {
    const schema = z.object({
      channel: z.enum(['telegram', 'whatsapp']),
      message: z.string().min(1).max(4000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!messagingBridge.isConnected(parsed.data.channel)) {
      return {
        success: false,
        content: '',
        error: `${parsed.data.channel} is not connected. Use messaging_setup_${parsed.data.channel} first.`,
      };
    }

    const ok = await messagingBridge.sendMessage({
      channel: parsed.data.channel,
      to: '',
      text: parsed.data.message,
    });

    if (!ok) {
      return { success: false, content: '', error: `Failed to send message on ${parsed.data.channel}` };
    }

    if (parsed.data.channel === 'whatsapp') {
      const link = messagingBridge.getWhatsAppLink();
      const msg = parsed.data.message.slice(0, 300);
      return {
        success: true,
        content: `## 📱 WhatsApp Message Ready\n\n**Message:** ${msg}${parsed.data.message.length > 300 ? '...' : ''}\n\n👉 [Tap to open in WhatsApp](${link})\n\n*Note: WhatsApp only supports one-way sending via wa.me links. You need to tap send in WhatsApp for the message to actually be delivered. For full two-way chat, use Telegram.*`,
      };
    }

    return {
      success: true,
      content: `## ✅ Telegram Message Sent\n\n**Message:** ${parsed.data.message.slice(0, 300)}${parsed.data.message.length > 300 ? '...' : ''}`,
    };
  },
};

const messagingSetMentionOnly: Tool = {
  id: 'messaging_set_mention_only',
  name: 'messaging_set_mention_only',
  description: 'Toggle whether GIA responds to all Telegram group messages or only when @mentioned. When mention-only is ON, GIA will only respond in groups when someone uses @bot_username. DMs are always answered.',
  schema: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', description: 'true = only respond when @mentioned, false = respond to all group messages' },
    },
    required: ['enabled'],
  },
  execute: async (args) => {
    const schema = z.object({ enabled: z.boolean() });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    messagingBridge.setMentionOnly(parsed.data.enabled);
    const mode = parsed.data.enabled ? 'only when @mentioned' : 'to all group messages';
    return {
      success: true,
      content: `## 🔔 Mention Mode ${parsed.data.enabled ? 'ON' : 'OFF'}\n\nGIA will now respond **${mode}**.\n\nUse \`messaging_set_mention_only enabled: false\` to switch back.`,
    };
  },
};

export const messagingTools: Tool[] = [
  messagingStatus,
  messagingSetupTelegram,
  messagingSetupWhatsApp,
  messagingDisconnect,
  messagingSend,
  messagingSetMentionOnly,
];
