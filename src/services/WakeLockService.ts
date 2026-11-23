import { logger } from '../utils/logger';

/**
 * Screen Wake Lock lifecycle, done the way the spec recommends:
 *  - The browser auto-releases the lock whenever the page becomes hidden.
 *  - The previous implementation treated that release event as "re-acquire
 *    now!", which (a) fails while hidden — the lock silently dies forever
 *    because nothing re-acquires on visible — and (b) kept the screen on
 *    indefinitely in every other case, one of the biggest battery drains a
 *    phone can experience.
 *  - Now: release on hidden, re-acquire on visible — but only while the
 *    feature is still active. While hidden we hold nothing.
 */
class WakeLockService {
  private static instance: WakeLockService;
  private wakeLock: WakeLockSentinel | null = null;
  private active = false;

  static getInstance(): WakeLockService {
    if (!this.instance) this.instance = new WakeLockService();
    return this.instance;
  }

  async start(): Promise<boolean> {
    if (this.active) return true;
    if (!('wakeLock' in navigator)) {
      logger.log('[WakeLock] Screen Wake Lock API not supported');
      return false;
    }

    this.active = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    // Only acquire when visible — request() rejects while hidden.
    if (document.visibilityState === 'visible') {
      return this.acquire();
    }
    return true;
  }

  private async acquire(): Promise<boolean> {
    if (!this.active || document.visibilityState !== 'visible') return false;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      logger.log('[WakeLock] Acquired');
      return true;
    } catch (e) {
      logger.warn('[WakeLock] Failed to acquire:', e);
      return false;
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible') {
      // The browser released the lock while hidden — take it back if the
      // feature is still wanted. No-op when active was turned off.
      if (this.active && !this.wakeLock) void this.acquire();
    }
    // While hidden: nothing to do. The browser already released the lock
    // and we intentionally do not fight it (battery).
  };

  async stop(): Promise<void> {
    this.active = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch { /* noop */ }
      this.wakeLock = null;
    }
    logger.log('[WakeLock] Released');
  }

  isHeld(): boolean {
    return this.wakeLock !== null && this.active;
  }
}

export default WakeLockService.getInstance();
