export interface TelegramChannelConfig {
  botToken: string;
  channelId: string;
  channelName?: string;
  connected: boolean;
  lastChecked?: number;
}

export interface TelegramChannelInfo {
  id: number;
  title: string;
  username?: string;
  description?: string;
  memberCount: number;
  photoUrl?: string;
}

export interface TelegramPostResult {
  messageId: number;
  channelId: string;
  content: string;
  sentAt: number;
}

class TelegramChannelService {
  private config: TelegramChannelConfig | null = null;
  private storeKey = 'gia-telegram-channel';

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(this.storeKey);
      if (raw) this.config = JSON.parse(raw);
    } catch { this.config = null; /* invalid JSON */ }
  }

  private save() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(this.config));
    } catch { /* ignore */ }
  }

  getConfig(): TelegramChannelConfig | null {
    return this.config;
  }

  isConfigured(): boolean {
    return !!(this.config?.botToken && this.config?.channelId);
  }

  configure(botToken: string, channelId: string, channelName?: string): void {
    this.config = { botToken, channelId, channelName, connected: false };
    this.save();
  }

  disconnect(): void {
    this.config = null;
    this.save();
  }

  private get apiBase(): string {
    if (!this.config) throw new Error('Telegram not configured. Use telegram_setup first.');
    return `https://api.telegram.org/bot${this.config.botToken}`;
  }

  private get chatId(): string {
    if (!this.config) throw new Error('Telegram not configured.');
    return this.config.channelId.startsWith('@') || this.config.channelId.startsWith('-')
      ? this.config.channelId
      : `@${this.config.channelId}`;
  }

  async getChannelInfo(): Promise<TelegramChannelInfo> {
    const res = await fetch(`${this.apiBase}/getChat?chat_id=${encodeURIComponent(this.chatId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Failed to get channel info');

    const memberRes = await fetch(`${this.apiBase}/getChatMemberCount?chat_id=${encodeURIComponent(this.chatId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    const memberData = await memberRes.json();
    const memberCount = memberData.ok ? memberData.result : 0;

    if (this.config) {
      this.config.channelName = data.result.title;
      this.config.connected = true;
      this.config.lastChecked = Date.now();
      this.save();
    }

    return {
      id: data.result.id,
      title: data.result.title,
      username: data.result.username,
      description: data.result.description,
      memberCount,
      photoUrl: data.result.photo?.small_file_id,
    };
  }

  async sendMessage(text: string, options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
    silent?: boolean;
  }): Promise<TelegramPostResult> {
    const body: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
    };
    if (options?.parseMode) body.parse_mode = options.parseMode;
    if (options?.disablePreview) body.disable_web_page_preview = true;
    if (options?.silent) body.disable_notification = true;

    const res = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Failed to send message');

    return {
      messageId: data.result.message_id,
      channelId: this.chatId,
      content: text,
      sentAt: Date.now(),
    };
  }

  async sendPhoto(photoUrl: string, caption?: string): Promise<TelegramPostResult> {
    const body: Record<string, unknown> = {
      chat_id: this.chatId,
      photo: photoUrl,
    };
    if (caption) body.caption = caption;

    const res = await fetch(`${this.apiBase}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Failed to send photo');

    return {
      messageId: data.result.message_id,
      channelId: this.chatId,
      content: caption || '(photo)',
      sentAt: Date.now(),
    };
  }

  async getStats(): Promise<{
    memberCount: number;
    adminCount: number;
    onlineCount?: number;
  }> {
    const [memberRes, adminRes] = await Promise.all([
      fetch(`${this.apiBase}/getChatMemberCount?chat_id=${encodeURIComponent(this.chatId)}`, {
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`${this.apiBase}/getChatAdministrators?chat_id=${encodeURIComponent(this.chatId)}`, {
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    const memberData = await memberRes.json();
    const adminData = await adminRes.json();

    return {
      memberCount: memberData.ok ? memberData.result : 0,
      adminCount: adminData.ok ? adminData.result.length : 0,
    };
  }
}

export default new TelegramChannelService();
