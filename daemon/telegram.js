/**
 * Telegram Bot API poller for the GIA gateway daemon.
 * Uses long polling to receive messages in real-time.
 */
/* eslint-env node */
import fetch from 'node-fetch';

export class TelegramPoller {
  constructor(botToken, channelId) {
    if (!botToken) throw new Error('botToken required');
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    this.channelId = channelId;
    this.offset = 0;
    this._running = false;
    this._timeout = 30; // Long polling timeout
    this._interval = 2000; // Retry delay
    this._handlers = { message: [], error: [] };
  }

  onMessage(handler) {
    this._handlers.message.push(handler);
  }

  onError(handler) {
    this._handlers.error.push(handler);
  }

  isRunning() {
    return this._running;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._poll();
  }

  stop() {
    this._running = false;
  }

  async _poll() {
    while (this._running) {
      try {
        const url = `${this.baseUrl}/getUpdates?timeout=${this._timeout}&offset=${this.offset}&allowed_updates=["message","channel_post"]`;
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          this._emit('error', new Error(`HTTP ${res.status}: ${text}`));
          await this._sleep(this._interval);
          continue;
        }
        const data = await res.json();
        if (!data.ok) {
          this._emit('error', new Error(`API error: ${data.description}`));
          await this._sleep(this._interval);
          continue;
        }
        if (data.result && data.result.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            const msg = update.message || update.channel_post;
            if (msg) {
              this._emit('message', msg);
            }
          }
        }
      } catch (err) {
        this._emit('error', err);
        await this._sleep(this._interval);
      }
    }
    console.log('[telegram] Poller stopped');
  }

  async sendMessage(chatId, text, opts = {}) {
    const url = `${this.baseUrl}/sendMessage`;
    const body = { chat_id: chatId, text, parse_mode: 'HTML', ...opts };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to send message: ${errText}`);
    }
    return res.json();
  }

  async sendPhoto(chatId, photoUrl, caption) {
    const url = `${this.baseUrl}/sendPhoto`;
    const body = { chat_id: chatId, photo: photoUrl };
    if (caption) body.caption = caption;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to send photo: ${errText}`);
    }
    return res.json();
  }

  async getMe() {
    const res = await fetch(`${this.baseUrl}/getMe`);
    const data = await res.json();
    return data.ok ? data.result : null;
  }

  async getChat(chatId) {
    const res = await fetch(`${this.baseUrl}/getChat?chat_id=${chatId}`);
    const data = await res.json();
    return data.ok ? data.result : null;
  }

  _emit(event, payload) {
    for (const h of this._handlers[event] || []) {
      try { h(payload); } catch (err) { console.error('[telegram] handler error:', err); }
    }
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
