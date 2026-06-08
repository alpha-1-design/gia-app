import { logger } from '../utils/logger';

class DesktopNotifications {
  private _granted = false;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.supported) return false;
    if (Notification.permission === 'granted') {
      this._granted = true;
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    this._granted = result === 'granted';
    return this._granted;
  }

  notify(title: string, options?: { body?: string; icon?: string; tag?: string }): void {
    if (!this.supported || !this._granted) return;
    if (typeof document !== 'undefined' && !document.hidden) return;
    try {
      new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag || 'gia',
        silent: false,
      });
    } catch (e) { logger.error('[DesktopNotifications] Notification API not supported:', e); }
  }

  async notifyOnComplete(title: string, body: string): Promise<void> {
    if (!this._granted) await this.requestPermission();
    this.notify(title, { body, tag: 'gia-response' });
  }
}

export default new DesktopNotifications();
