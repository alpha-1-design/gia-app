import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type Module = 'chat' | 'writer' | 'analyst' | 'planner' | 'settings' | 'exam';
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
  thoughts?: string;
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
  interval: 'hourly' | 'daily' | 'weekly';
  nextRun: number;
  lastResult?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface SkillTool {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[]; 
  category: 'core' | 'user' | 'dev' | 'creative';
}

export interface UserProfile {
  name: string;
  bio: string;
  goals: string;
}

export interface Clarification {
  question: string;
  options: string[];
  sessionId: string;
  assistantMsgId: string;
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
  skills: Skill[];
  activeSkillId: string | null;
  examHistory: ExamResult[];
  consoleLogs: { id: string; timestamp: number; type: 'thought' | 'tool' | 'result' | 'error'; content: string }[];
  showConsole: boolean;
  
  webSearch: boolean;
  extThinking: boolean;
  handsOff: boolean;
  clarification: Clarification | null;
  wakeWord: string;
  keepListening: boolean;
  customInstructions: string;
  pinnedMemories: string[];

  setModule: (module: Module) => void;
  setClarification: (c: Clarification | null) => void;
  setIntentState: (state: IntentState) => void;
  setShowTerminal: (show: boolean) => void;
  setWebSearch: (enabled: boolean) => void;
  setExtThinking: (enabled: boolean) => void;
  setHandsOff: (enabled: boolean) => void;
  setWakeWord: (word: string) => void;
  setKeepListening: (on: boolean) => void;
  setSharedData: (data: Record<string, unknown>) => void;
  updateSharedData: (data: Record<string, unknown>) => void;
  createSession: () => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  updateMessage: (sessionId: string, msgId: string, content: string, thoughts?: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  forkSession: (sessionId: string, fromIndex: number) => string;
  clearSession: (sessionId: string) => void;
  getActiveSession: () => ChatSession | null;
  addScheduledTask: (task: ScheduledTask) => void;
  updateTaskStatus: (id: string, status: ScheduledTask['status'], result?: string, nextRun?: number) => void;
  deleteTask: (id: string) => void;
  setUserProfile: (p: Partial<UserProfile>) => void;
  addNotification: (msg: string) => void;
  clearNotification: (id: string) => void;
  addExamResult: (r: ExamResult) => void;
  clearExamHistory: () => void;
  hibernateSessions: () => void;
  setSkill: (id: string | null) => void;
  addSkill: (skill: Skill) => void;
  removeSkill: (id: string) => void;
  setCustomInstructions: (text: string) => void;
  togglePinnedMemory: (id: string) => void;
  addConsoleLog: (log: { type: 'thought' | 'tool' | 'result' | 'error'; content: string }) => void;
  setShowConsole: (show: boolean) => void;
  clearConsole: () => void;
}

export interface ExamResult {
  id: string;
  examSystem: string;
  subject: string;
  topic: string;
  score: number;
  correct: number;
  total: number;
  weakAreas: string[];
  timestamp: number;
  timeSpent: number;
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
      skills: [
        {
          id: 'core-general',
          name: 'General Assistant',
          description: 'Balanced assistance for general tasks.',
          systemPrompt: 'You are GIA, a highly capable AI assistant. Be concise, helpful, and professional.',
          tools: ['web_search', 'terminal_run', 'filesystem_read', 'filesystem_write'],
          category: 'core'
        },
        {
          id: 'core-developer',
          name: 'Developer Mode',
          description: 'Expert software engineering and coding assistance.',
          systemPrompt: 'You are GIA in Developer Mode. Focus on technical correctness, performance, and clean architecture. Provide production-ready code and thorough architectural explanations.',
          tools: ['web_search', 'terminal_run', 'filesystem_read', 'filesystem_write', 'zip_project'],
          category: 'dev'
        },
        {
          id: 'skill-researcher',
          name: 'Research Analyst',
          description: 'Deep web research, data synthesis and source verification.',
          systemPrompt: 'You are GIA in Research Mode. Your goal is to provide exhaustive, evidence-based answers. Always use web_search to verify current facts, cross-reference multiple sources, and provide a structured synthesis of findings with citations.',
          tools: ['web_search', 'filesystem_read', 'filesystem_write'],
          category: 'core'
        },
        {
          id: 'skill-creative',
          name: 'Creative Architect',
          description: 'Professional copywriting, storytelling and creative conceptualization.',
          systemPrompt: 'You are GIA in Creative Mode. Focus on evocative language, narrative flow and high-impact communication. Help the user draft compelling content, brainstorm unique concepts, and polish creative work.',
          tools: ['web_search', 'image_generation'],
          category: 'creative'
        },
        {
          id: 'skill-tutor',
          name: 'Academic Tutor',
          description: 'WASSCE/BECE tuned educational support and exam prep.',
          systemPrompt: 'You are GIA in Tutor Mode. Specialize in WASSCE and BECE curricula. Instead of just giving answers, guide the student through the logic. Provide practice questions, clear explanations of complex concepts, and structured study plans.',
          tools: ['web_search', 'filesystem_read'],
          category: 'core'
        },
        {
          id: 'skill-security',
          name: 'Security Expert',
          description: 'Audit code for vulnerabilities and suggest hardening strategies.',
          systemPrompt: 'You are GIA in Security Mode. Analyze code for OWASP Top 10 vulnerabilities, logic flaws and security leaks. Provide clear mitigation steps and secure coding alternatives. Prioritize the principle of least privilege.',
          tools: ['terminal_run', 'filesystem_read', 'web_search'],
          category: 'dev'
        }
      ],
      activeSkillId: 'core-general',
      examHistory: [],
      consoleLogs: [],
      showConsole: false,
      webSearch: false,
      extThinking: false,
      handsOff: false,
      clarification: null,
      wakeWord: localStorage.getItem('gia-wake-word') || 'hey gia',
      keepListening: localStorage.getItem('gia-keep-listening') !== 'false',
      customInstructions: localStorage.getItem('gia-custom-instructions') || '',
      pinnedMemories: JSON.parse(localStorage.getItem('gia-pinned-memories') || '[]'),

      setModule: (module) => set({ currentModule: module }),
      setClarification: (c) => set({ clarification: c }),
      setIntentState: (state) => set({ intentState: state }),
      setShowTerminal: (show) => set({ showTerminal: show }),
      setWebSearch: (enabled) => set({ webSearch: enabled }),
      setExtThinking: (enabled) => set({ extThinking: enabled }),
      setHandsOff: (enabled) => set({ handsOff: enabled }),
      setWakeWord: (word) => {
        localStorage.setItem('gia-wake-word', word);
        set({ wakeWord: word });
      },
      setKeepListening: (on) => {
        localStorage.setItem('gia-keep-listening', String(on));
        set({ keepListening: on });
      },
      setCustomInstructions: (text) => {
        localStorage.setItem('gia-custom-instructions', text);
        set({ customInstructions: text });
      },
      togglePinnedMemory: (id) => set((s) => {
        const pinned = s.pinnedMemories.includes(id)
          ? s.pinnedMemories.filter(pid => pid !== id)
          : [...s.pinnedMemories, id];
        localStorage.setItem('gia-pinned-memories', JSON.stringify(pinned));
        return { pinnedMemories: pinned };
      }),
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

      updateMessage: (sessionId, msgId, content, thoughts) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: sess.messages.map((m) => (m.id === msgId ? { ...m, content, ...(thoughts !== undefined ? { thoughts } : {}), thinking: false } : m)) }
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
      updateTaskStatus: (id, status, result, nextRun) =>
        set((s) => ({
          scheduledTasks: s.scheduledTasks.map((t) => (t.id === id ? { ...t, status, lastResult: result ?? t.lastResult, ...(nextRun !== undefined ? { nextRun } : {}) } : t)),
        })),
      deleteTask: (id) => set((s) => ({ scheduledTasks: s.scheduledTasks.filter((t) => t.id !== id) })),

      setUserProfile: (p) => set((s) => ({ userProfile: { ...s.userProfile, ...p } })),

      addNotification: (msg) =>
        set((s) => ({ notifications: [{ id: genId(), message: msg, ts: Date.now() }, ...s.notifications.slice(0, 9)] })),
      clearNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      addExamResult: (r) => set((s) => ({ examHistory: [r, ...s.examHistory].slice(0, 50) })),
      clearExamHistory: () => set({ examHistory: [] }),
      hibernateSessions: () => {
        const { sessions } = get();
        const active = sessions.find(s => s.id === get().activeSessionId);
        if (!active) return;
        const inactive = sessions.filter(s => s.id !== active.id && s.messages.length > 0);
        if (inactive.length <= 5) return;
        const toArchive = inactive.slice(0, inactive.length - 5).map(s => ({
          ...s, messages: s.messages.slice(0, 1).map(m => ({ ...m, content: `Archived — ${m.content.slice(0, 100)}` }))
        }));
        set((s) => ({
          sessions: s.sessions.map(sess =>
            toArchive.find(a => a.id === sess.id)
              ? { ...sess, messages: sess.messages.slice(0, 1).map(m => ({ ...m, content: `Archived — ${m.content.slice(0, 100)}` })) }
              : sess
          ),
        }));
      },
      setSkill: (id) => set({ activeSkillId: id }),
      addSkill: (skill) => set((s) => ({ skills: s.skills.find(sk => sk.id === skill.id) ? s.skills : [...s.skills, skill] })),
      removeSkill: (id) => set((s) => ({ skills: s.skills.filter(sk => sk.id !== id) })),
      addConsoleLog: (log) => set((s) => ({
        consoleLogs: [...s.consoleLogs, { ...log, id: Math.random().toString(36).slice(2), timestamp: Date.now() }].slice(-100)
      })),
      setShowConsole: (show) => set({ showConsole: show }),
      clearConsole: () => set({ consoleLogs: [] }),
    }),
    {
      name: 'gia-store-v3',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        scheduledTasks: s.scheduledTasks,
        userProfile: s.userProfile,
        skills: s.skills,
        activeSkillId: s.activeSkillId,
        examHistory: s.examHistory,
        webSearch: s.webSearch,
        extThinking: s.extThinking,
        handsOff: s.handsOff,
      }),
    }
  )
);
