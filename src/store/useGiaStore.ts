import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';

export type Module = 'chat' | 'writer' | 'analyst' | 'planner' | 'settings' | 'exam' | 'autonomy';
export type IntentState = 'idle' | 'typing' | 'analyst' | 'writer' | 'planner' | 'thinking' | 'responding';
export type ThinkingPhase = 'gathering' | 'analyzing' | 'coding' | 'writing' | 'searching' | 'planning' | 'reasoning' | 'processing' | 'idle';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  timestamp: number;
  attachments?: { name: string; type: string; content: string; preview?: string }[];
  sources?: (string | { url: string; title?: string })[];
  model?: string;
  thinking?: boolean;
  thoughts?: string;
  tokenUsage?: { input: number; output: number; total: number };
  parentId?: string;
  branchId?: string;
}

export interface MessageNode {
  message: Message;
  children: MessageNode[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: MessageNode[]; // Tree structure
  createdAt: number;
  updatedAt: number;
  currentBranchId: string; // Active branch
  branches?: Record<string, { id: string; name: string; createdAt: number }>; // Named branches
}

// Tree helper functions
function addMessageToTree(nodes: MessageNode[], msg: Message, branchId: string): MessageNode[] {
  const newNode: MessageNode = { message: { ...msg, branchId }, children: [] };
  
  if (msg.parentId) {
    // Find parent and add as child
    return nodes.map(node => {
      if (node.message.id === msg.parentId) {
        return { ...node, children: [...node.children, newNode] };
      }
      if (node.children.length > 0) {
        return { ...node, children: addMessageToTree(node.children, msg, branchId) };
      }
      return node;
    });
  }
  
  // Root message
  return [...nodes, newNode];
}

function updateMessageInTree(nodes: MessageNode[], msgId: string, content: string, thoughts?: string): MessageNode[] {
  return nodes.map(node => {
    if (node.message.id === msgId) {
      return { ...node, message: { ...node.message, content, ...(thoughts !== undefined ? { thoughts } : {}), thinking: false } };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateMessageInTree(node.children, msgId, content, thoughts) };
    }
    return node;
  });
}

function findMessageInTree(nodes: MessageNode[], msgId: string): MessageNode | null {
  for (const node of nodes) {
    if (node.message.id === msgId) return node;
    if (node.children.length > 0) {
      const found = findMessageInTree(node.children, msgId);
      if (found) return found;
    }
  }
  return null;
}

function getPathToMessage(nodes: MessageNode[], msgId: string): MessageNode[] {
  const path: MessageNode[] = [];
  
  function dfs(node: MessageNode): boolean {
    path.push(node);
    if (node.message.id === msgId) return true;
    for (const child of node.children) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  }
  
  for (const node of nodes) {
    if (dfs(node)) break;
  }
  return path;
}

function clonePathAsNewBranch(nodes: MessageNode[], path: MessageNode[], newBranchId: string): MessageNode[] {
  if (path.length === 0) return [];
  
  // Clone the path, each node gets the new branchId
  const clonedPath = path.map(p => ({
    message: { ...p.message, branchId: newBranchId },
    children: [] as MessageNode[]
  }));
  
  // Link them as parent-child
  for (let i = clonedPath.length - 1; i > 0; i--) {
    clonedPath[i - 1].children = [clonedPath[i]];
  }
  
  return [clonedPath[0]];
}

function flattenBranch(nodes: MessageNode[], branchId: string): Message[] {
  const result: Message[] = [];
  
  function traverse(node: MessageNode) {
    if (node.message.branchId === branchId || branchId === 'all') {
      result.push(node.message);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return result;
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
  channel?: 'telegram' | 'whatsapp';
}

export interface SkillTool {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
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
  showProtocols: boolean;
  
  webSearch: boolean;
  extThinking: boolean;
  handsOff: boolean;
  localVision: boolean;
  localSummarize: boolean;
  localTranslate: boolean;
  responseCache: boolean;
  inputGuardrails: boolean;
  outputValidation: boolean;
  smartFallback: boolean;
  thinkingPhase: ThinkingPhase;
  clarification: Clarification | null;
  wakeWord: string;
  keepListening: boolean;
  autoStartWakeWord: boolean;
  voiceLanguage: string;
  nativeWakeWord: boolean;
  nativeSensitivity: number;
  wakeWordAccessKey: string;
  useWhisper: boolean;
  setUseWhisper: (v: boolean) => void;
  customInstructions: string;
  pinnedMemories: string[];
  theme: 'dark' | 'light' | 'system';
  connectionStatus: 'online' | 'offline';
  providerConnected: boolean;
  currentTool: string | null;
  showCircleSearch: boolean;
  setShowCircleSearch: (v: boolean) => void;
  pendingCircleImage: string | null;
  setPendingCircleImage: (v: string | null) => void;
  pendingInput: string | null;
  setPendingInput: (v: string | null) => void;
  pendingFiles: { name: string; type: string; content: string; preview?: string }[];
  setPendingFiles: (v: { name: string; type: string; content: string; preview?: string }[]) => void;
  pendingAction: { type: string; data: Record<string, unknown> } | null;
  setPendingAction: (v: { type: string; data: Record<string, unknown> } | null) => void;
  deepLinkQueue: string[];
  setDeepLinkQueue: (v: string[]) => void;

  setModule: (module: Module) => void;
  setCurrentTool: (tool: string | null) => void;
  setClarification: (c: Clarification | null) => void;
  setIntentState: (state: IntentState) => void;
  setShowTerminal: (show: boolean) => void;
  setWebSearch: (enabled: boolean) => void;
  setExtThinking: (enabled: boolean) => void;
  setHandsOff: (enabled: boolean) => void;
  setLocalVision: (enabled: boolean) => void;
  setLocalSummarize: (enabled: boolean) => void;
  setLocalTranslate: (enabled: boolean) => void;
  setResponseCache: (enabled: boolean) => void;
  setInputGuardrails: (enabled: boolean) => void;
  setOutputValidation: (enabled: boolean) => void;
  setSmartFallback: (enabled: boolean) => void;
  setThinkingPhase: (phase: ThinkingPhase) => void;
  setWakeWord: (word: string) => void;
  setKeepListening: (on: boolean) => void;
  setAutoStartWakeWord: (on: boolean) => void;
  setVoiceLanguage: (lang: string) => void;
  setNativeWakeWord: (on: boolean) => void;
  setNativeSensitivity: (val: number) => void;
  setWakeWordAccessKey: (key: string) => void;
  setSharedData: (data: Record<string, unknown>) => void;
  updateSharedData: (data: Record<string, unknown>) => void;
  createSession: () => string;
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  updateMessage: (sessionId: string, msgId: string, content: string, thoughts?: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  forkSession: (sessionId: string, msgId: string) => string;
  clearSession: (sessionId: string) => void;
  getActiveSession: () => ChatSession | null;
  switchBranch: (sessionId: string, branchId: string) => void;
  getBranchMessages: (sessionId: string, branchId: string) => Message[];
  getAllBranchIds: (sessionId: string) => string[];
  addBranch: (sessionId: string, fromMsgId: string, branchName?: string) => string;
  renameBranch: (sessionId: string, branchId: string, name: string) => void;
  deleteBranch: (sessionId: string, branchId: string) => void;
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
  setShowProtocols: (show: boolean) => void;
  longRunningMode: boolean;
  autoModelUnload: boolean;
  setLongRunningMode: (v: boolean) => void;
  setAutoModelUnload: (v: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setConnectionStatus: (status: 'online' | 'offline') => void;
  setProviderConnected: (connected: boolean) => void;
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
      showProtocols: false,
      webSearch: true,
      extThinking: false,
      handsOff: false,
      localVision: false,
      localSummarize: true,
      localTranslate: false,
      responseCache: true,
      inputGuardrails: true,
      outputValidation: true,
      smartFallback: true,
      thinkingPhase: 'idle',
      clarification: null,
      wakeWord: (() => { try { return localStorage.getItem('gia-wake-word') || 'hey gia'; } catch { return 'hey gia'; } })(),
      keepListening: (() => { try { return localStorage.getItem('gia-keep-listening') === 'true'; } catch { return false; } })(),
      autoStartWakeWord: (() => { try { return localStorage.getItem('gia-auto-start-wake-word') === 'true'; } catch { return false; } })(),
      voiceLanguage: (() => { try { return localStorage.getItem('gia-voice-language') || 'en-US'; } catch { return 'en-US'; } })(),
      nativeWakeWord: (() => { try { return localStorage.getItem('gia-native-wake-word') !== 'false'; } catch { return true; } })(),
      nativeSensitivity: (() => { try { return parseFloat(localStorage.getItem('gia-native-sensitivity') || '0.7'); } catch { return 0.7; } })(),
      wakeWordAccessKey: (() => { try { return localStorage.getItem('gia-wake-word-access-key') || ''; } catch { return ''; } })(),
      useWhisper: localStorage.getItem('gia-use-whisper') === 'true',
      customInstructions: (() => { try { return localStorage.getItem('gia-custom-instructions') || ''; } catch { return ''; } })(),
      pinnedMemories: (() => { try { return JSON.parse(localStorage.getItem('gia-pinned-memories') || '[]'); } catch { return []; } })(),
      theme: 'dark',
      connectionStatus: navigator.onLine ? 'online' : 'offline',
      providerConnected: false,
      currentTool: null,
      showCircleSearch: false,
      pendingCircleImage: null,
      pendingInput: null,
      pendingFiles: [],
      pendingAction: null,
      deepLinkQueue: [],
      longRunningMode: false,
      autoModelUnload: true,

      setModule: (module) => set({ currentModule: module }),
      setCurrentTool: (tool) => set({ currentTool: tool }),
      setClarification: (c) => set({ clarification: c }),
      setIntentState: (state) => set({ intentState: state }),
      setShowTerminal: (show) => set({ showTerminal: show }),
      setWebSearch: (enabled) => set({ webSearch: enabled }),
      setExtThinking: (enabled) => set({ extThinking: enabled }),
      setHandsOff: (enabled) => set({ handsOff: enabled }),
      setLocalVision: (enabled) => set({ localVision: enabled }),
      setLocalSummarize: (enabled) => set({ localSummarize: enabled }),
      setLocalTranslate: (enabled) => set({ localTranslate: enabled }),
      setResponseCache: (enabled) => set({ responseCache: enabled }),
      setInputGuardrails: (enabled) => set({ inputGuardrails: enabled }),
      setOutputValidation: (enabled) => set({ outputValidation: enabled }),
      setSmartFallback: (enabled) => set({ smartFallback: enabled }),
      setThinkingPhase: (phase) => set({ thinkingPhase: phase }),
      setWakeWord: (word) => {
        localStorage.setItem('gia-wake-word', word);
        set({ wakeWord: word });
      },
      setKeepListening: (on) => {
        localStorage.setItem('gia-keep-listening', String(on));
        set({ keepListening: on });
      },
      setAutoStartWakeWord: (on) => {
        localStorage.setItem('gia-auto-start-wake-word', String(on));
        set({ autoStartWakeWord: on });
      },
      setVoiceLanguage: (lang) => {
        localStorage.setItem('gia-voice-language', lang);
        set({ voiceLanguage: lang });
      },
      setNativeWakeWord: (on) => {
        localStorage.setItem('gia-native-wake-word', String(on));
        set({ nativeWakeWord: on });
      },
      setNativeSensitivity: (val) => {
        localStorage.setItem('gia-native-sensitivity', String(val));
        set({ nativeSensitivity: val });
      },
      setWakeWordAccessKey: (key) => {
        localStorage.setItem('gia-wake-word-access-key', key);
        set({ wakeWordAccessKey: key });
      },
      setUseWhisper: (v) => {
        localStorage.setItem('gia-use-whisper', String(v));
        set({ useWhisper: v });
      },
      setShowCircleSearch: (v) => set({ showCircleSearch: v }),
      setPendingCircleImage: (v) => set({ pendingCircleImage: v }),
      setPendingInput: (v) => set({ pendingInput: v }),
      setPendingFiles: (v) => set({ pendingFiles: v }),
      setPendingAction: (v) => set({ pendingAction: v }),
      setDeepLinkQueue: (v) => set({ deepLinkQueue: v }),
      setLongRunningMode: (v) => { localStorage.setItem('gia-long-running', String(v)); set({ longRunningMode: v }); },
      setAutoModelUnload: (v) => { localStorage.setItem('gia-auto-model-unload', String(v)); set({ autoModelUnload: v }); },
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
        const branchId = genId();
        set((s) => ({
          sessions: [{ id, title: 'New Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now(), currentBranchId: branchId }, ...s.sessions],
          activeSessionId: id,
        }));
        return id;
      },
      setActiveSession: (id) => set({ activeSessionId: id }),

      addMessage: (sessionId, msg) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: addMessageToTree(sess.messages, msg, sess.currentBranchId), updatedAt: Date.now() }
              : sess
          ),
        })),

      updateMessage: (sessionId, msgId, content, thoughts) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: updateMessageInTree(sess.messages, msgId, content, thoughts) }
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

      forkSession: (sessionId, msgId) => {
        const { sessions } = get();
        const orig = sessions.find((s) => s.id === sessionId);
        if (!orig) return sessionId;
        const branchId = genId();
        const newId = genId();
        const parentMsg = findMessageInTree(orig.messages, msgId);
        if (!parentMsg) return sessionId;
        
        // Get path from root to parent message
        const path = getPathToMessage(orig.messages, msgId);
        
        // Create new tree with only the path, then add as new branch
        const newTree = clonePathAsNewBranch(orig.messages, path, branchId);
        
        set((s) => ({
          sessions: [{ id: newId, title: `Branch: ${orig.title}`, messages: newTree, createdAt: Date.now(), updatedAt: Date.now(), currentBranchId: branchId }, ...s.sessions],
          activeSessionId: newId,
        }));
        return newId;
      },

      clearSession: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, messages: [], title: 'New Chat', updatedAt: Date.now(), currentBranchId: genId() } : sess
          ),
        })),

      switchBranch: (sessionId, branchId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, currentBranchId: branchId, updatedAt: Date.now() } : sess
          ),
        })),

      getBranchMessages: (sessionId, branchId) => {
        const { sessions } = get();
        const sess = sessions.find((s) => s.id === sessionId);
        if (!sess) return [];
        return flattenBranch(sess.messages, branchId);
      },

      getAllBranchIds: (sessionId) => {
        const { sessions } = get();
        const sess = sessions.find((s) => s.id === sessionId);
        if (!sess) return [];
        const branchIds = new Set<string>();
        function collect(nodes: MessageNode[]) {
          for (const node of nodes) {
            if (node.message.branchId) branchIds.add(node.message.branchId);
            collect(node.children);
          }
        }
        collect(sess.messages);
        return Array.from(branchIds);
      },

      addBranch: (sessionId, fromMsgId, branchName) => {
        const { sessions } = get();
        const orig = sessions.find((s) => s.id === sessionId);
        if (!orig) return sessionId;
        const branchId = genId();
        const newBranchName = branchName || `Branch ${Object.keys(orig.branches || {}).length + 1}`;
        const parentMsg = findMessageInTree(orig.messages, fromMsgId);
        if (!parentMsg) return sessionId;
        
        // Get path from root to parent message
        const path = getPathToMessage(orig.messages, fromMsgId);
        
        // Clone path as new branch
        const newTree = clonePathAsNewBranch(orig.messages, path, branchId);
        
        // Get existing root messages that are NOT in this path, keeping them too
        const otherRoots = orig.messages.filter(m => !path.find(p => p.message.id === m.message.id));
        
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? {
                  ...sess,
                  messages: [...newTree, ...otherRoots],
                  currentBranchId: branchId,
                  updatedAt: Date.now(),
                  branches: {
                    ...(sess.branches || {}),
                    [branchId]: { id: branchId, name: newBranchName, createdAt: Date.now() },
                  },
                }
              : sess
          ),
        }));
        return branchId;
      },

      renameBranch: (sessionId, branchId, name) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, branches: { ...(sess.branches || {}), [branchId]: { ...(sess.branches?.[branchId] || { id: branchId, createdAt: Date.now() }), name } } }
              : sess
          ),
        })),

      deleteBranch: (sessionId, branchId) =>
        set((s) => {
          const sess = s.sessions.find((se) => se.id === sessionId);
          if (!sess) return s;
          const allIds = (() => {
            const ids = new Set<string>();
            function collect(nodes: MessageNode[]) {
              for (const node of nodes) {
                if (node.message.branchId) ids.add(node.message.branchId);
                collect(node.children);
              }
            }
            collect(sess.messages);
            return Array.from(ids);
          })();
          if (allIds.length <= 1) return s;
          const newCurrent = sess.currentBranchId === branchId
            ? allIds.find((id) => id !== branchId) || sess.currentBranchId
            : sess.currentBranchId;
          return {
            sessions: s.sessions.map((se) =>
              se.id === sessionId
                ? {
                    ...se,
                    messages: se.messages.filter((m) => m.message.branchId !== branchId),
                    currentBranchId: newCurrent,
                    branches: Object.fromEntries(
                      Object.entries(se.branches || {}).filter(([k]) => k !== branchId)
                    ),
                  }
                : se
            ),
          };
        }),

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
          ...s, messages: s.messages.slice(0, 1).map(m => ({ ...m.message, content: `Archived — ${m.message.content.slice(0, 100)}` } as Message))
        }));
        set((s) => ({
          sessions: s.sessions.map(sess =>
            toArchive.find(a => a.id === sess.id)
              ? { ...sess, messages: sess.messages.slice(0, 1).map(m => ({ message: { ...m.message, content: `Archived — ${m.message.content.slice(0, 100)}` }, children: m.children })) }
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
      setShowProtocols: (show) => set({ showProtocols: show }),
      setTheme: (theme) => set({ theme }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setProviderConnected: (connected) => set({ providerConnected: connected }),
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
        theme: s.theme,
        wakeWord: s.wakeWord,
        keepListening: s.keepListening,
        autoStartWakeWord: s.autoStartWakeWord,
        voiceLanguage: s.voiceLanguage,
        nativeWakeWord: s.nativeWakeWord,
        nativeSensitivity: s.nativeSensitivity,
        wakeWordAccessKey: s.wakeWordAccessKey,
        useWhisper: s.useWhisper,
      }),
    }
  )
);
