import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import smartNotificationEngine, { type NotificationCategory } from '../services/SmartNotificationEngine';

export type NotificationSource = 'android' | 'web' | 'bridge' | 'system' | 'whatsapp' | 'unimind';

export interface CapturedNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  timestamp: number;
  source: NotificationSource;
  read: boolean;
  dismissed: boolean;
  category: 'message' | 'alert' | 'reminder' | 'social' | 'email' | 'system' | 'other';
}

interface NotificationState {
  notifications: CapturedNotification[];
  enabled: boolean;
  autoSummarize: boolean;
  intelligentFiltering: boolean;
  addNotification: (n: Omit<CapturedNotification, 'id' | 'timestamp' | 'read' | 'dismissed'>) => void;
  markRead: (id: string) => void;
  markDismissed: (id: string) => void;
  getUnread: () => CapturedNotification[];
  getRecent: (count?: number) => CapturedNotification[];
  getNotificationsByApp: (app: string) => CapturedNotification[];
  setEnabled: (enabled: boolean) => void;
  /** Deliver any due digest batches from the SmartNotificationEngine as a summary notification. */
  flushDigests: () => void;
  clear: () => void;
}

// Map the store's coarse category onto the engine's richer taxonomy. When
// there's no clean mapping we let the engine classify from title/body text.
function toEngineCategory(cat?: CapturedNotification['category']): NotificationCategory | undefined {
  switch (cat) {
    case 'message': return 'message';
    case 'email': return 'email';
    case 'social': return 'social';
    case 'system': return 'system';
    case 'reminder': return 'calendar';
    default: return undefined;
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      enabled: true,
      autoSummarize: true,
      intelligentFiltering: true,

      addNotification: (n) => {
        const id = genId();
        // Intelligent filtering — run every incoming notification through the
        // SmartNotificationEngine. Security/critical/urgent pass through
        // immediately; promotional + high-dismissal sources are silenced;
        // email/social/update noise is batched into a digest. Only when the
        // engine says 'immediate' does the notification hit the list.
        if (get().intelligentFiltering) {
          const decision = smartNotificationEngine.process({
            id,
            title: n.title,
            body: n.body,
            source: n.source,
            timestamp: Date.now(),
            category: toEngineCategory(n.category),
          });
          if (decision.action === 'silent') {
            smartNotificationEngine.learnWithContext(id, n.source, toEngineCategory(n.category) ?? 'unknown', 'dismissed');
            return;
          }
          if (decision.action === 'batch') return; // held in the engine's digest
        }
        set((s) => ({
          notifications: [
            { ...n, id, timestamp: Date.now(), read: false, dismissed: false },
            ...s.notifications,
          ].slice(0, 500),
        }));
      },

      markRead: (id) => {
        const n = get().notifications.find((x) => x.id === id);
        set((s) => ({
          notifications: s.notifications.map((x) =>
            x.id === id ? { ...x, read: true } : x
          ),
        }));
        if (n && get().intelligentFiltering) {
          smartNotificationEngine.learnWithContext(n.id, n.source, toEngineCategory(n.category) ?? 'unknown', 'acted_on');
        }
      },

      markDismissed: (id) => {
        const n = get().notifications.find((x) => x.id === id);
        set((s) => ({
          notifications: s.notifications.map((x) =>
            x.id === id ? { ...x, dismissed: true } : x
          ),
        }));
        if (n && get().intelligentFiltering) {
          smartNotificationEngine.learnWithContext(n.id, n.source, toEngineCategory(n.category) ?? 'unknown', 'dismissed');
        }
      },

      flushDigests: () => {
        for (const batch of smartNotificationEngine.deliverAllDue()) {
          const count = batch.notifications.length;
          const titles = batch.notifications.slice(0, 3).map((x) => x.title).join(', ');
          const digestId = genId();
          set((s) => ({
            notifications: [
              {
                id: digestId,
                app: 'GIA Digest',
                title: `📥 ${count} notification${count > 1 ? 's' : ''} while you were away`,
                body: titles + (count > 3 ? '…' : ''),
                timestamp: Date.now(),
                read: false,
                dismissed: false,
                source: 'system' as const,
                category: 'other' as const,
              },
              ...s.notifications,
            ].slice(0, 500),
          }));
        }
      },

      getUnread: () => get().notifications.filter((n) => !n.read && !n.dismissed),

      getRecent: (count = 20) => get().notifications.slice(0, count),

      getNotificationsByApp: (app) =>
        get().notifications.filter((n) => n.app.toLowerCase() === app.toLowerCase()),

      setEnabled: (enabled) => set({ enabled }),
      clear: () => {
        set({ notifications: [] });
        smartNotificationEngine.clearBatches();
      },
    }),
    {
      name: 'gia-notifications-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        notifications: s.notifications,
        enabled: s.enabled,
        autoSummarize: s.autoSummarize,
        intelligentFiltering: s.intelligentFiltering,
      }),
    }
  )
);

// Load the engine's persisted learning once at startup — triage decisions work
// immediately and get smarter as the learned model hydrates.
void smartNotificationEngine.init();
