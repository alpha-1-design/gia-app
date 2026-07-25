import { logger } from '../utils/logger';
import { automationEngine } from './AutomationEngine';
import { useMoodStore } from '../store/useMoodStore';
import { useAutonomyStore } from '../store/useAutonomyStore';
import { useGiaStore } from '../store/useGiaStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useKnowledgeGraphStore } from '../store/useKnowledgeGraphStore';

export interface BridgeEvent {
  type: string;
  params: Record<string, string>;
  timestamp: number;
}

type EventCallback = (event: BridgeEvent) => void;

const MAX_HISTORY = 100;

export class EventBridge {
  private running = false;
  private unsubscribers: Array<() => void> = [];
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private eventHistory: BridgeEvent[] = [];

  on(type: string, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.watchMoodChanges();
    this.watchEntities();
    this.watchGoalStatus();
    this.watchNotifications();
    this.watchMessages();

    logger.info('[EventBridge] Started — monitoring 5 signal sources');
  }

  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.running = false;
    logger.info('[EventBridge] Stopped');
  }

  getHistory(): readonly BridgeEvent[] {
    return this.eventHistory;
  }

  private dispatch(type: string, params: Record<string, string>): void {
    const event: BridgeEvent = { type, params, timestamp: Date.now() };

    this.eventHistory.push(event);
    if (this.eventHistory.length > MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-MAX_HISTORY);
    }

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const cb of typeListeners) {
        try { cb(event); } catch (e) { logger.warn('[EventBridge] Listener error:', e); }
      }
    }

    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const cb of wildcardListeners) {
        try { cb(event); } catch (e) { logger.warn('[EventBridge] Listener error:', e); }
      }
    }

    logger.debug(`[EventBridge] Event: ${type}`, params);
    automationEngine.fireEvent(type, params);
  }

  private watchMoodChanges(): void {
    let prevMood: string = useMoodStore.getState().getCurrentMood();

    const unsub = useMoodStore.subscribe((state) => {
      const currentMood = state.getCurrentMood();
      if (currentMood !== prevMood) {
        this.dispatch('mood_change', {
          from: prevMood,
          to: currentMood,
        });
        prevMood = currentMood;
      }
    });
    this.unsubscribers.push(unsub);
  }

  private watchEntities(): void {
    let prevCount = useKnowledgeGraphStore.getState().entities.length;

    const unsub = useKnowledgeGraphStore.subscribe((state) => {
      const currentCount = state.entities.length;
      if (currentCount > prevCount) {
        const newEntities = state.entities.slice(prevCount);
        for (const entity of newEntities) {
          this.dispatch('entity_mentioned', {
            name: entity.name,
            type: entity.type,
          });
        }
        prevCount = currentCount;
      }
    });
    this.unsubscribers.push(unsub);
  }

  private watchGoalStatus(): void {
    const prevStatuses = new Map<string, string>();
    for (const g of useAutonomyStore.getState().goals) {
      prevStatuses.set(g.id, g.status);
    }

    const unsub = useAutonomyStore.subscribe((state) => {
      for (const goal of state.goals) {
        const prev = prevStatuses.get(goal.id);
        if (prev !== undefined && prev !== goal.status) {
          this.dispatch('goal_status', {
            goalId: goal.id,
            goalTitle: goal.title,
            status: goal.status,
            progress: String(goal.progress),
          });
        }
        prevStatuses.set(goal.id, goal.status);
      }
    });
    this.unsubscribers.push(unsub);
  }

  private watchNotifications(): void {
    let prevCount = useGiaStore.getState().notifications.length;
    let prevCaptured = useNotificationStore.getState().notifications.length;

    const unsubGia = useGiaStore.subscribe((state) => {
      const currentCount = state.notifications.length;
      if (currentCount > prevCount) {
        const newest = state.notifications[0];
        this.dispatch('notification', {
          title: newest.message.slice(0, 80),
        });
        prevCount = currentCount;
      }
    });
    this.unsubscribers.push(unsubGia);

    const unsubCaptured = useNotificationStore.subscribe((state) => {
      const currentCount = state.notifications.length;
      if (currentCount > prevCaptured) {
        const newest = state.notifications[0];
        this.dispatch('notification', {
          title: newest.title,
          app: newest.app,
        });
        prevCaptured = currentCount;
      }
    });
    this.unsubscribers.push(unsubCaptured);
  }

  private watchMessages(): void {
    const prevCounts = new Map<string, number>();
    const activeSession = useGiaStore.getState().getActiveSession();
    if (activeSession) {
      prevCounts.set(activeSession.id, activeSession.messages.length);
    }

    const unsub = useGiaStore.subscribe((state) => {
      const sessions = state.sessions;
      for (const session of sessions) {
        const prev = prevCounts.get(session.id) ?? 0;
        const current = session.messages.length;
        if (current > prev) {
          const newest = session.messages[session.messages.length - 1];
          if (newest.message.role === 'user') {
            this.dispatch('message', {
              sessionId: session.id,
              content: newest.message.content.slice(0, 200),
            });
          }
        }
        prevCounts.set(session.id, current);
      }
    });
    this.unsubscribers.push(unsub);
  }
}

const eventBridge = new EventBridge();
export default eventBridge;
