import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../../utils/id', () => ({
  genId: vi.fn(() => 'nid-' + Math.random().toString(36).slice(2, 8)),
}));

import { useNotificationStore } from '../useNotificationStore';

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], enabled: true });
  });

  it('starts with empty notifications', () => {
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('addNotification adds with id, timestamp, read=false, dismissed=false', () => {
    useNotificationStore.getState().addNotification({
      app: 'Telegram', title: 'New message', body: 'Hello', source: 'android', category: 'message',
    });
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBeDefined();
    expect(notifs[0].title).toBe('New message');
    expect(notifs[0].read).toBe(false);
    expect(notifs[0].dismissed).toBe(false);
    expect(notifs[0].timestamp).toBeGreaterThan(0);
  });

  it('addNotification prepends (newest first)', () => {
    useNotificationStore.getState().addNotification({ app: 'A', title: 'First', body: '', source: 'web', category: 'system' });
    useNotificationStore.getState().addNotification({ app: 'B', title: 'Second', body: '', source: 'web', category: 'system' });
    expect(useNotificationStore.getState().notifications[0].title).toBe('Second');
  });

  it('caps at 500 notifications', () => {
    for (let i = 0; i < 510; i++) {
      useNotificationStore.getState().addNotification({ app: 'A', title: `n${i}`, body: '', source: 'web', category: 'system' });
    }
    expect(useNotificationStore.getState().notifications.length).toBeLessThanOrEqual(500);
  });

  it('markRead sets read to true', () => {
    useNotificationStore.getState().addNotification({ app: 'A', title: 'Test', body: '', source: 'web', category: 'system' });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
  });

  it('markDismissed sets dismissed to true', () => {
    useNotificationStore.getState().addNotification({ app: 'A', title: 'Test', body: '', source: 'web', category: 'system' });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markDismissed(id);
    expect(useNotificationStore.getState().notifications[0].dismissed).toBe(true);
  });

  it('getUnread returns only unread and not dismissed', () => {
    useNotificationStore.getState().addNotification({ app: 'A', title: 'a', body: '', source: 'web', category: 'system' });
    useNotificationStore.getState().addNotification({ app: 'B', title: 'b', body: '', source: 'web', category: 'system' });
    // Notifications are prepended (newest first), so 'b' is at index 0, 'a' at index 1
    const idA = useNotificationStore.getState().notifications[1].id;
    useNotificationStore.getState().markRead(idA);
    const unread = useNotificationStore.getState().getUnread();
    expect(unread).toHaveLength(1);
    expect(unread[0].title).toBe('b');
  });

  it('getRecent returns first N notifications', () => {
    for (let i = 0; i < 10; i++) {
      useNotificationStore.getState().addNotification({ app: 'A', title: `n${i}`, body: '', source: 'web', category: 'system' });
    }
    expect(useNotificationStore.getState().getRecent(3)).toHaveLength(3);
    expect(useNotificationStore.getState().getRecent()).toHaveLength(10);
  });

  it('getNotificationsByApp filters by app name', () => {
    useNotificationStore.getState().addNotification({ app: 'Telegram', title: 'tg', body: '', source: 'android', category: 'message' });
    useNotificationStore.getState().addNotification({ app: 'WhatsApp', title: 'wa', body: '', source: 'android', category: 'message' });
    const tgNotifs = useNotificationStore.getState().getNotificationsByApp('telegram');
    expect(tgNotifs).toHaveLength(1);
    expect(tgNotifs[0].title).toBe('tg');
  });

  it('clear removes all notifications', () => {
    useNotificationStore.getState().addNotification({ app: 'A', title: 'Test', body: '', source: 'web', category: 'system' });
    useNotificationStore.getState().clear();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('setEnabled toggles', () => {
    useNotificationStore.getState().setEnabled(false);
    expect(useNotificationStore.getState().enabled).toBe(false);
    useNotificationStore.getState().setEnabled(true);
    expect(useNotificationStore.getState().enabled).toBe(true);
  });
});
