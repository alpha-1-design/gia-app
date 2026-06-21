import { logger } from '../utils/logger';

class KeepaliveService {
  private static instance: KeepaliveService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private intervalMs = 25000;

  static getInstance(): KeepaliveService {
    if (!this.instance) this.instance = new KeepaliveService();
    return this.instance;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;

    this.intervalId = setInterval(() => {
      if (!this.active) return;
      performance.now();
    }, this.intervalMs);

    logger.log('[Keepalive] Started');
  }

  async stop(): Promise<void> {
    this.active = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.log('[Keepalive] Stopped');
  }

  isRunning(): boolean {
    return this.active;
  }
}

export default KeepaliveService.getInstance();
