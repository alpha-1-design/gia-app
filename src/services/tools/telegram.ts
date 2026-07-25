import { z } from 'zod';
import telegramChannel from '../social/TelegramChannelService';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

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

const telegramSetup: Tool = {
  id: 'telegram_setup',
  name: 'telegram_setup',
  description: 'Configure your Telegram bot token and channel to let GIA manage your Telegram channel. Get the bot token from @BotFather on Telegram, then add the bot as admin to your channel.',
  schema: {
    type: 'object',
    properties: {
      botToken: { type: 'string', description: 'Bot token from @BotFather (e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)' },
      channelId: { type: 'string', description: 'Channel username (e.g. mychannel) or ID (e.g. -1001234567890)' },
      channelName: { type: 'string', description: 'Optional friendly name for the channel' },
    },
    required: ['botToken', 'channelId'],
  },
  execute: async (args) => {
    const schema = z.object({
      botToken: z.string().min(1, 'Bot token is required'),
      channelId: z.string().min(1, 'Channel ID or username is required'),
      channelName: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { botToken, channelId, channelName } = parsed.data;
    telegramChannel.configure(botToken, channelId, channelName);

    try {
      const info = await telegramChannel.getChannelInfo();
      return {
        success: true,
        content: `## ✅ Telegram Channel Connected\n\n**Channel:** ${info.title}${info.username ? ` (@${info.username})` : ''}\n**Members:** ${info.memberCount.toLocaleString()}\n${info.description ? `**Description:** ${info.description}\n` : ''}\n\nYour bot is connected and GIA can now post to your channel.`,
      };
    } catch (e) {
      return {
        success: true,
        content: `⚠️ Configuration saved but could not verify connection. The channel info will be fetched when you use telegram_channel_info.\n\nMake sure:\n1. The bot token is correct (from @BotFather)\n2. You added the bot as an admin to your channel\n3. The channel ID is correct\n\nError: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

const telegramChannelInfo: Tool = {
  id: 'telegram_channel_info',
  name: 'telegram_channel_info',
  description: 'Get information about the connected Telegram channel (title, description, member count, photo).',
  execute: async () => {
    try {
      const info = await telegramChannel.getChannelInfo();
      return {
        success: true,
        content: `## 📢 Channel Info\n\n**Title:** ${info.title}\n${info.username ? `**Username:** @${info.username}\n` : ''}${info.description ? `**Description:** ${info.description}\n` : ''}**Members:** ${info.memberCount.toLocaleString()}${info.photoUrl ? '\n**Photo:** Available' : ''}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const telegramPost: Tool = {
  id: 'telegram_post',
  name: 'telegram_post',
  description: 'Send a text message to your Telegram channel. Supports HTML and Markdown formatting.',
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Message text to send (up to 4096 characters)' },
      parseMode: { type: 'string', enum: ['HTML', 'Markdown', 'MarkdownV2'], description: 'Formatting mode (default: HTML). Use <b>bold</b>, <i>italic</i>, <a href="url">link</a> etc.' },
      silent: { type: 'boolean', description: 'Send silently without notifying subscribers' },
    },
    required: ['text'],
  },
  execute: async (args) => {
    const schema = z.object({
      text: z.string().min(1).max(4096),
      parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
      silent: z.boolean().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { text, parseMode, silent } = parsed.data;
    try {
      const result = await telegramChannel.sendMessage(text, { parseMode, silent });
      return {
        success: true,
        content: `## ✅ Message Posted to Telegram\n\n**Message ID:** ${result.messageId}\n**Time:** ${new Date(result.sentAt).toLocaleString()}\n\n**Content:**\n> ${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const telegramPostPhoto: Tool = {
  id: 'telegram_post_photo',
  name: 'telegram_post_photo',
  description: 'Send a photo with optional caption to your Telegram channel.',
  schema: {
    type: 'object',
    properties: {
      photoUrl: { type: 'string', description: 'URL of the photo to send' },
      caption: { type: 'string', description: 'Optional caption for the photo' },
    },
    required: ['photoUrl'],
  },
  execute: async (args) => {
    const schema = z.object({
      photoUrl: z.string().url('Must be a valid URL'),
      caption: z.string().max(1024).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    const { photoUrl, caption } = parsed.data;
    try {
      const result = await telegramChannel.sendPhoto(photoUrl, caption);
      return {
        success: true,
        content: `## ✅ Photo Posted to Telegram\n\n**Message ID:** ${result.messageId}\n**Time:** ${new Date(result.sentAt).toLocaleString()}\n${caption ? `**Caption:** ${caption.slice(0, 300)}` : '(no caption)'}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const telegramStats: Tool = {
  id: 'telegram_stats',
  name: 'telegram_stats',
  description: 'Get Telegram channel statistics including member count and admin count.',
  execute: async () => {
    try {
      const stats = await telegramChannel.getStats();
      return {
        success: true,
        content: `## 📊 Telegram Channel Stats\n\n- **Members:** ${stats.memberCount.toLocaleString()}\n- **Admins:** ${stats.adminCount}`,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const telegramStatus: Tool = {
  id: 'telegram_status',
  name: 'telegram_status',
  description: 'Check whether Telegram is configured and connected. Shows current bot token and channel info.',
  execute: async () => {
    const cfg = telegramChannel.getConfig();
    if (!cfg) {
      return { success: true, content: '## ❌ Telegram Not Configured\n\nUse `telegram_setup` to connect your bot and channel.\n\n**How to set up:**\n1. Create a bot via @BotFather on Telegram and get the token\n2. Add your bot as an admin to your channel\n3. Run `telegram_setup` with the token and channel ID' };
    }
    const maskedToken = cfg.botToken.slice(0, 8) + '...' + cfg.botToken.slice(-4);
    return {
      success: true,
      content: `## 📱 Telegram Status\n\n**Bot Token:** \`${maskedToken}\`\n**Channel:** ${cfg.channelId}${cfg.channelName ? ` (${cfg.channelName})` : ''}\n**Connected:** ${cfg.connected ? '✅ Yes' : '❌ No (verify with telegram_channel_info)'}\n${cfg.lastChecked ? `**Last Checked:** ${new Date(cfg.lastChecked).toLocaleString()}` : ''}`,
    };
  },
};

const telegramDisconnect: Tool = {
  id: 'telegram_disconnect',
  name: 'telegram_disconnect',
  description: 'Disconnect Telegram bot and remove stored configuration.',
  execute: async () => {
    telegramChannel.disconnect();
    return { success: true, content: '🔌 Telegram disconnected and configuration removed.' };
  },
};

export const telegramTools: Tool[] = [
  telegramSetup,
  telegramChannelInfo,
  telegramPost,
  telegramPostPhoto,
  telegramStats,
  telegramStatus,
  telegramDisconnect,
];


export function registerTelegramTools() {
  for (const tool of telegramTools) ToolRegistry.register(tool);
}
