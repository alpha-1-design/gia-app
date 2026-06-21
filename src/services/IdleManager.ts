import { logger } from '../utils/logger';

class IdleManager {
  private static instance: IdleManager;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private idleTimeoutMs = 10 * 60 * 1000;
  private lastActivity = Date.now();
  private onIdle: (() => void)[] = [];
  private onActive: (() => void)[] = [];

  static getInstance(): IdleManager {
    if (!this.instance) this.instance = new IdleManager();
    return this.instance;
  }

  start(timeoutMs: number = 10 * 60 * 1000): void {
    if (this.active) return;
    this.active = true;
    this.idleTimeoutMs = timeoutMs;
    this.lastActivity = Date.now();
    this.resetTimer();
    logger.log(`[IdleManager] Started (timeout: ${timeoutMs / 1000}s)`);
  }

  stop(): void {
    this.active = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    logger.log('[IdleManager] Stopped');
  }

  ping(): void {
    const wasIdle = this.isIdle();
    this.lastActivity = Date.now();
    if (wasIdle) {
      logger.log('[IdleManager] Activity detected — no longer idle');
      for (const cb of this.onActive) cb();
    }
    this.resetTimer();
  }

  private resetTimer(): void {
    if (!this.active) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.active) return;
      logger.log('[IdleManager] Idle timeout reached');
      for (const cb of this.onIdle) cb();
    }, this.idleTimeoutMs);
  }

  onIdleTimeout(cb: () => void): () => void {
    this.onIdle.push(cb);
    return () => {
      this.onIdle = this.onIdle.filter(c => c !== cb);
    };
  }

  onActiveAgain(cb: () => void): () => void {
    this.onActive.push(cb);
    return () => {
      this.onActive = this.onActive.filter(c => c !== cb);
    };
  }

  isIdle(): boolean {
    return Date.now() - this.lastActivity >= this.idleTimeoutMs;
  }

  getLastActivity(): number {
    return this.lastActivity;
  }

  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
    if (this.active) this.resetTimer();
  }
}

export default IdleManager.getInstance();
