import { logger } from '../utils/logger';

/**
 * KeepaliveService — keeps the WebView JS engine from being fully frozen
 * while a long-running task (autonomy step, streaming generation, Telegram
 * relay) needs background time.
 *
 * Battery contract:
 *  1. On native Android, the foreground service (GIACoreService +
 *     START_STICKY) already keeps the process alive — Chrome throttles
 *     background WebView timers to ~1/min no matter what we do, so a JS
 *     timer is useless there. We only run on web/PWA builds.
 *  2. While the app is HIDDEN the interval pauses (visibilitychange);
 *     browsers throttle hidden timers anyway and every fire costs a CPU
 *     wakeup. It resumes when the app becomes visible again.
 */
class KeepaliveService {
  private static instance: KeepaliveService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private visible = true;
  private intervalMs = 25000;
  private onVisibility: () => void = () => this.sync();

  static getInstance(): KeepaliveService {
    if (!this.instance) this.instance = new KeepaliveService();
    return this.instance;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    document.addEventListener('visibilitychange', this.onVisibility);
    this.sync();
    logger.log('[Keepalive] Started');
  }

  async stop(): Promise<void> {
    this.active = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.log('[Keepalive] Stopped');
  }

  /** Start/stop the actual interval based on both flags. */
  private sync(): void {
    if (typeof document !== 'undefined') {
      this.visible = document.visibilityState === 'visible';
    }
    const shouldRun = this.active && this.visible;
    if (shouldRun && this.intervalId === null) {
      this.intervalId = setInterval(() => {
        // Heartbeat tick: existence is the point — it keeps the WebView's
        // process scheduler from parking the renderer while long-running
        // mode is active and the app is visible.
        performance.now();
      }, this.intervalMs);
    } else if (!shouldRun && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.active;
  }
}

export default KeepaliveService.getInstance();
