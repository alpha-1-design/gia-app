import { Capacitor, registerPlugin } from '@capacitor/core';
import { useProviderStore } from '../store/useProviderStore';
import { useTaskStore } from '../store/useTaskStore';
import { logger } from '../utils/logger';

interface GIAWidgetPlugin {
  update: (opts: { providerConnected: boolean; providerName: string; nextTask: string | null }) => Promise<void>;
}

/**
 * WidgetSyncService — keeps the Android home-screen GIA widget live.
 *
 * The native AppWidget reads provider/task state from its own preferences;
 * this service is the only writer. It subscribes to the provider + task stores
 * and pushes a debounced snapshot (provider pill + next task) to the native
 * GIAWidgetPlugin, which also computes battery/storage on-device.
 */
class WidgetSyncService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly plugin = registerPlugin<GIAWidgetPlugin>('GIAWidget');

  start() {
    if (!Capacitor.isNativePlatform()) return;
    useProviderStore.subscribe(() => this.scheduleSync());
    useTaskStore.subscribe(() => this.scheduleSync());
    // Initial push on app boot (widget may have been placed while app closed)
    this.sync();
    logger.log('[WidgetSync] home-screen widget sync started');
  }

  private scheduleSync() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), 1000);
  }

  private sync() {
    if (!Capacitor.isNativePlatform()) return;

    const ps = useProviderStore.getState();
    const activeId = ps.activeProvider;
    const cfg = ps.providers?.[activeId];
    const connected = !!(cfg?.enabled && cfg.apiKey && cfg.apiKey.trim().length > 0);
    const providerName = connected ? activeId.toUpperCase() : 'GIA';

    const tasks = useTaskStore.getState().tasks ?? [];
    const open = tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        const rank = (p: string) => (p === 'critical' ? 3 : p === 'high' ? 2 : p === 'medium' ? 1 : 0);
        return rank(b.priority) - rank(a.priority);
      });
    const nextTask = open[0]?.title ?? null;

    this.plugin
      .update({ providerConnected: connected, providerName, nextTask })
      .catch(() => { /* plugin missing on non-Android native — ignore */ });
  }
}

export default new WidgetSyncService();
