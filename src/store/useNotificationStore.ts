import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export type NotificationSource = 'android' | 'web' | 'bridge' | 'system';

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
  clear: () => void;
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
        set((s) => ({
          notifications: [
            { ...n, id, timestamp: Date.now(), read: false, dismissed: false },
            ...s.notifications,
          ].slice(0, 500),
        }));
      },

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markDismissed: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, dismissed: true } : n
          ),
        })),

      getUnread: () => get().notifications.filter((n) => !n.read && !n.dismissed),

      getRecent: (count = 20) => get().notifications.slice(0, count),

      getNotificationsByApp: (app) =>
        get().notifications.filter((n) => n.app.toLowerCase() === app.toLowerCase()),

      setEnabled: (enabled) => set({ enabled }),
      clear: () => set({ notifications: [] }),
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
