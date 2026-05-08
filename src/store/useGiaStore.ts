import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type Module = 'chat' | 'writer' | 'analyst' | 'planner' | 'settings';
export type IntentState = 'idle' | 'typing' | 'analyst' | 'writer' | 'planner' | 'thinking' | 'responding';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  timestamp: number;
  attachments?: { name: string; type: string; content: string; preview?: string }[];
  sources?: string[];
  model?: string;
  thinking?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cronLabel: string;
  nextRun: number;
  lastResult?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface UserProfile {
  name: string;
  bio: string;
  goals: string;
}

interface GiaState {
  currentModule: Module;
  intentState: IntentState;
  showTerminal: boolean;
  sharedData: Record<string, unknown>;
  sessions: ChatSession[];
  activeSessionId: string | null;
  scheduledTasks: ScheduledTask[];
  userProfile: UserProfile;
  notifications: { id: string; message: string; ts: number }[];

  setModule: (module: Module) => void;
  setIntentState: (state: IntentState) => void;
  setShowTerminal: (show: boolean) => void;
  setSharedData: (data: Record<string, unknown>) => void;
  updateSharedData: (data: Record<string, unknown>) => void;
  createSession: () => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  updateMessage: (sessionId: string, msgId: string, content: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  forkSession: (sessionId: string, fromIndex: number) => string;
  clearSession: (sessionId: string) => void;
  getActiveSession: () => ChatSession | null;
  addScheduledTask: (task: ScheduledTask) => void;
  updateTaskStatus: (id: string, status: ScheduledTask['status'], result?: string) => void;
  deleteTask: (id: string) => void;
  setUserProfile: (p: Partial<UserProfile>) => void;
  addNotification: (msg: string) => void;
  clearNotification: (id: string) => void;
  // Hibernation support
  hibernateSessions: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 10);

export const useGiaStore = create<GiaState>()(
  persist(
    (set, get) => ({
      currentModule: 'chat',
      intentState: 'idle',
      showTerminal: false,
      sharedData: {},
      sessions: [],
      activeSessionId: null,
      scheduledTasks: [],
      userProfile: { name: '', bio: '', goals: '' },
      notifications: [],

      setModule: (module) => set({ currentModule: module }),
      setIntentState: (state) => set({ intentState: state }),
      setShowTerminal: (show) => set({ showTerminal: show }),
      setSharedData: (data) => set({ sharedData: data }),
      updateSharedData: (data) => set((s) => ({ sharedData: { ...s.sharedData, ...data } })),

      createSession: () => {
        const id = genId();
        set((s) => ({
          sessions: [{ id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() }, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },
      setActiveSession: (id) => set({ activeSessionId: id }),

      addMessage: (sessionId, msg) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, messages: [...sess.messages, msg], updatedAt: Date.now() } : sess
          ),
        })),

      updateMessage: (sessionId, msgId, content) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: sess.messages.map((m) => (m.id === msgId ? { ...m, content, thinking: false } : m)) }
              : sess
          ),
        })),

      updateSessionTitle: (sessionId, title) =>
        set((s) => ({ sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, title } : sess)) })),

      deleteSession: (sessionId) =>
        set((s) => {
          const sessions = s.sessions.filter((sess) => sess.id !== sessionId);
          return { sessions, activeSessionId: s.activeSessionId === sessionId ? (sessions[0]?.id ?? null) : s.activeSessionId };
        }),

      forkSession: (sessionId, fromIndex) => {
        const { sessions } = get();
        const orig = sessions.find((s) => s.id === sessionId);
        if (!orig) return sessionId;
        const id = genId();
        set((s) => ({
          sessions: [{ id, title: `Fork: ${orig.title}`, messages: orig.messages.slice(0, fromIndex + 1), createdAt: Date.now(), updatedAt: Date.now() }, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      clearSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, messages: [], title: 'New Chat', updatedAt: Date.now() } : sess
          ),
        })),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId) ?? null;
      },

      addScheduledTask: (task) => set((s) => ({ scheduledTasks: [task, ...s.scheduledTasks] })),
      updateTaskStatus: (id, status, result) =>
        set((s) => ({
          scheduledTasks: s.scheduledTasks.map((t) => (t.id === id ? { ...t, status, lastResult: result ?? t.lastResult } : t)),
        })),
      deleteTask: (id) => set((s) => ({ scheduledTasks: s.scheduledTasks.filter((t) => t.id !== id) })),

      setUserProfile: (p) => set((s) => ({ userProfile: { ...s.userProfile, ...p } })),

      addNotification: (msg) =>
        set((s) => ({ notifications: [{ id: genId(), message: msg, ts: Date.now() }, ...s.notifications.slice(0, 9)] })),
      clearNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      hibernateSessions: () => {
        const { sessions, activeSessionId } = get();
        // Skip hibernation if we have very few sessions
        if (sessions.length <= 4) return;

        set((s) => ({
          sessions: s.sessions.map((sess, idx) => {
            if (sess.id === activeSessionId || idx < 4) return sess;
            // Hibernating by emptying messages array is DANGEROUS with persist().
            // Instead, we should mark it as hibernated and handle loading logic,
            // or simply remove the feature if memory isn't a critical issue yet.
            // For now, let's just keep the data safe.
            return sess; 
          }),
        }));
      },
    }),
    {
      name: 'gia-store-v3',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        scheduledTasks: s.scheduledTasks,
        userProfile: s.userProfile,
      }),
    }
  )
);
