import { logger } from '../utils/logger';

class WakeLockService {
  private static instance: WakeLockService;
  private wakeLock: WakeLockSentinel | null = null;
  private active = false;
  private releaseHandler: (() => void) | null = null;

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
    return this.acquire();
  }

  private async acquire(): Promise<boolean> {
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.releaseHandler = () => {
        if (this.active) {
          logger.log('[WakeLock] Released by browser, re-acquiring…');
          this.acquire();
        }
      };
      this.wakeLock.addEventListener('release', this.releaseHandler);
      logger.log('[WakeLock] Acquired');
      return true;
    } catch (e) {
      logger.warn('[WakeLock] Failed to acquire:', e);
      return false;
    }
  }

  async stop(): Promise<void> {
    this.active = false;
    if (this.wakeLock) {
      if (this.releaseHandler) {
        this.wakeLock.removeEventListener('release', this.releaseHandler);
      }
      try { await this.wakeLock.release(); } catch { /* noop */ }
      this.wakeLock = null;
      this.releaseHandler = null;
    }
    logger.log('[WakeLock] Released');
  }

  isHeld(): boolean {
    return this.wakeLock !== null && this.active;
  }
}

export default WakeLockService.getInstance();
