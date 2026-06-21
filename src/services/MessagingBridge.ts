import { logger } from '../utils/logger';
import telegramChannel from './social/TelegramChannelService';

export interface MessagingChannel {
  type: 'telegram' | 'whatsapp';
  label: string;
  connected: boolean;
  config: Record<string, string>;
}

export interface IncomingMessage {
  id: string;
  channel: 'telegram' | 'whatsapp';
  from: string;
  text: string;
  timestamp: number;
  chatId: string;
  chatTitle?: string;
  isGroup: boolean;
}

export interface OutgoingMessage {
  channel: 'telegram' | 'whatsapp';
  to: string;
  text: string;
}

type MessageHandler = (msg: IncomingMessage) => Promise<void>;

const STORE_KEY = 'gia-messaging-channels';

class MessagingBridge {
  private channels: Map<string, MessagingChannel> = new Map();
  private handlers: MessageHandler[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastUpdateId = 0;
  private active = false;
  private processedUpdates: Set<number> = new Set();
  private botToken: string | null = null;
  private botUsername: string | null = null;

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data: Record<string, MessagingChannel> = JSON.parse(raw);
        for (const [id, ch] of Object.entries(data)) {
          this.channels.set(id, ch);
          if (ch.type === 'telegram' && ch.config.botToken) {
            this.botToken = ch.config.botToken;
          }
        }
      }
    } catch { /* noop */ }
  }

  private save() {
    const data: Record<string, MessagingChannel> = {};
    for (const [id, ch] of this.channels) {
      data[id] = ch;
    }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  }

  getChannels(): MessagingChannel[] {
    return Array.from(this.channels.values());
  }

  getChannel(type: 'telegram' | 'whatsapp'): MessagingChannel | undefined {
    return this.channels.get(type);
  }

  isConnected(type: 'telegram' | 'whatsapp'): boolean {
    return this.channels.get(type)?.connected ?? false;
  }

  async configureTelegram(botToken: string): Promise<{ success: boolean; error?: string }> {
    // Fetch bot info to get username
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!data.ok) return { success: false, error: 'Invalid bot token' };
      this.botUsername = data.result.username;
    } catch {
      return { success: false, error: 'Failed to verify bot token' };
    }

    this.botToken = botToken;
    this.channels.set('telegram', {
      type: 'telegram',
      label: `@${this.botUsername}`,
      connected: true,
      config: { botToken: botToken.slice(0, 8) + '...' + botToken.slice(-4), mode: 'group', mentionOnly: 'false' },
    });
    this.save();
    logger.log(`[MessagingBridge] Configured as @${this.botUsername}`);
    return { success: true };
  }

  configureWhatsApp(phoneNumber: string): void {
    this.channels.set('whatsapp', {
      type: 'whatsapp',
      label: `WhatsApp (${phoneNumber})`,
      connected: true,
      config: { phoneNumber },
    });
    this.save();
  }

  disconnect(type: 'telegram' | 'whatsapp'): void {
    if (type === 'telegram') {
      this.botToken = null;
      this.botUsername = null;
      telegramChannel.disconnect();
    }
    this.channels.delete(type);
    this.save();
  }

  getWhatsAppLink(): string | null {
    return this.channels.get('whatsapp')?.config?.lastMessageUrl || null;
  }

  clearWhatsAppLink(): void {
    const ch = this.channels.get('whatsapp');
    if (ch) delete ch.config.lastMessageUrl;
  }

  setMentionOnly(enabled: boolean): void {
    const ch = this.channels.get('telegram');
    if (ch) {
      ch.config.mentionOnly = enabled ? 'true' : 'false';
      this.save();
    }
  }

  isMentionOnly(): boolean {
    return this.channels.get('telegram')?.config?.mentionOnly === 'true';
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  private async handleIncoming(msg: IncomingMessage): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(msg);
      } catch (e) {
        logger.error('[MessagingBridge] Handler error:', e);
      }
    }
  }

  async sendMessage(msg: OutgoingMessage): Promise<boolean> {
    try {
      if (msg.channel === 'telegram') {
        const token = this.botToken;
        if (!token) throw new Error('Telegram not configured');
        const chatId = msg.to || (() => {
          const stored = this.channels.get('telegram')?.config?.chatId;
          if (stored) return stored;
          throw new Error('No chat ID specified. Reply to a received message first.');
        })();
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg.text, parse_mode: 'HTML' }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.description || 'Telegram send failed');
        return true;
      }
      if (msg.channel === 'whatsapp') {
        const channel = this.channels.get('whatsapp');
        const phone = channel?.config?.phoneNumber;
        if (!phone) throw new Error('WhatsApp not configured');
        const text = encodeURIComponent(msg.text);
        const url = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`;
        channel!.config.lastMessageUrl = url;
        this.save();
        return true;
      }
      return false;
    } catch (e) {
      logger.error('[MessagingBridge] Send failed:', e);
      return false;
    }
  }

  async startPolling(): Promise<void> {
    if (this.active) return;
    if (!this.botToken) {
      logger.log('[MessagingBridge] No bot token, skipping polling');
      return;
    }

    this.active = true;
    logger.log('[MessagingBridge] Starting Telegram long polling for groups & DMs');

    this.pollTimer = setInterval(async () => {
      if (!this.active) return;
      try {
        await this.pollTelegram();
      } catch (e) {
        logger.warn('[MessagingBridge] Poll error:', e);
      }
    }, 3000);
  }

  private async pollTelegram(): Promise<void> {
    if (!this.botToken) return;

    const params = new URLSearchParams({
      timeout: '25',
      offset: String(this.lastUpdateId),
      allowed_updates: JSON.stringify(['message']),
    });

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?${params}`, {
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!data.ok) return;

    interface TelegramUpdate { update_id: number; message?: { message_id: number; text?: string; from?: { is_bot?: boolean; first_name?: string; username?: string }; chat: { id: number; type: string; title?: string }; date: number } }
    for (const update of (data.result || []) as TelegramUpdate[]) {
      this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id + 1);

      const msg = update.message;
      if (!msg?.text) continue;

      // Skip if already processed
      if (this.processedUpdates.has(update.update_id)) continue;
      this.processedUpdates.add(update.update_id);
      if (this.processedUpdates.size > 10000) {
        this.processedUpdates.clear();
      }

      // Skip messages from bots to avoid echo loops
      if (msg.from?.is_bot) continue;

      const chat = msg.chat;
      const isGroup = chat.type === 'group' || chat.type === 'supergroup';
      const chatTitle = chat.title || (isGroup ? 'Group' : undefined);

      // In mention-only mode, skip group messages that don't @mention the bot
      if (isGroup && this.isMentionOnly() && this.botUsername) {
        const mention = `@${this.botUsername.toLowerCase()}`;
        if (!msg.text.toLowerCase().includes(mention)) {
          continue;
        }
      }

      // Store the chat ID for replies
      const channel = this.channels.get('telegram');
      if (channel) {
        channel.config.chatId = String(chat.id);
        this.save();
      }

      const incoming: IncomingMessage = {
        id: String(update.update_id),
        channel: 'telegram',
        from: msg.from?.first_name || msg.from?.username || 'User',
        text: msg.text,
        timestamp: msg.date * 1000,
        chatId: String(chat.id),
        chatTitle,
        isGroup,
      };

      const ctx = isGroup ? `group "${chatTitle}"` : 'DM';
      logger.log(`[MessagingBridge] Incoming ${ctx} from ${incoming.from}: ${incoming.text.slice(0, 60)}`);

      await this.handleIncoming(incoming);
    }
  }

  stopPolling(): void {
    this.active = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.log('[MessagingBridge] Polling stopped');
  }

  isPolling(): boolean {
    return this.active;
  }

  /** Handle an incoming message forwarded from the service worker (cached while app was closed) */
  async handleIncomingFromSW(incoming: IncomingMessage): Promise<void> {
    const id = parseInt(incoming.id, 10);
    this.processedUpdates.add(id);
    if (id >= this.lastUpdateId) {
      this.lastUpdateId = id + 1;
    }
    if (this.processedUpdates.size > 10000) {
      this.processedUpdates.clear();
    }

    // Store chatId for replies
    const channel = this.channels.get('telegram');
    if (channel) {
      channel.config.chatId = incoming.chatId;
      this.save();
    }

    await this.handleIncoming(incoming);
  }

  /** Sync the internal offset from the SW (used after configuring SW polling) */
  syncOffset(offset: number): void {
    if (offset > this.lastUpdateId) {
      this.lastUpdateId = offset;
    }
  }

  /** Sync current offset to the service worker for continuity */
  syncOffsetToSW(): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'gia-tg-update-offset',
        offset: this.lastUpdateId,
      });
    }
  }

  /** Send config to the service worker so it can poll when the tab is closed */
  configureSWPolling(): void {
    if (!this.botToken) return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'gia-tg-configure',
        token: this.botToken,
        botUsername: this.botUsername,
        mentionOnly: this.isMentionOnly(),
        offset: this.lastUpdateId,
      });
    }).catch(() => {});
  }

  /** Tell SW to stop polling */
  stopSWPolling(): void {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: 'gia-tg-stop' });
    }).catch(() => {});
  }
}

export default new MessagingBridge();
