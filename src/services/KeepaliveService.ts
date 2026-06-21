import { logger } from '../utils/logger';

type KeepaliveMethod = 'audio' | 'interval' | 'worker';

class KeepaliveService {
  private static instance: KeepaliveService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private worker: Worker | null = null;
  private active = false;
  private intervalMs = 25000;

  static getInstance(): KeepaliveService {
    if (!this.instance) this.instance = new KeepaliveService();
    return this.instance;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;

    const methods: KeepaliveMethod[] = ['interval', 'audio', 'worker'];

    for (const method of methods) {
      try {
        this.startMethod(method);
      } catch (e) {
        logger.warn(`[Keepalive] Method "${method}" failed:`, e);
      }
    }

    logger.log('[Keepalive] Started');
  }

  private startMethod(method: KeepaliveMethod) {
    switch (method) {
      case 'interval':
        this.intervalId = setInterval(() => {
          if (!this.active) return;
          try {
            performance.now();
          } catch {}
        }, this.intervalMs);
        break;

      case 'audio':
        this.audioCtx = new AudioContext();
        break;

      case 'worker':
        try {
          const blob = new Blob([
            `self.onmessage=()=>{self.postMessage('ping')};setInterval(()=>{self.postMessage('ping')},${this.intervalMs});`,
          ], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          this.worker = new Worker(url);
          URL.revokeObjectURL(url);
        } catch {
          logger.warn('[Keepalive] Worker method not supported');
        }
        break;
    }
  }

  async stop(): Promise<void> {
    this.active = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.audioCtx) {
      try { await this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }

    if (this.worker) {
      try { this.worker.terminate(); } catch {}
      this.worker = null;
    }

    logger.log('[Keepalive] Stopped');
  }

  isRunning(): boolean {
    return this.active;
  }
}

export default KeepaliveService.getInstance();
