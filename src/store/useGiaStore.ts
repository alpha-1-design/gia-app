import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import { genId } from '../utils/id';
import { useMemoryStore } from './useMemoryStore';

const FEEDBACK_KEYS = { up: 'feedback:liked', down: 'feedback:disliked' } as const;

export type Module = 'chat' | 'writer' | 'analyst' | 'planner' | 'settings' | 'exam' | 'autonomy' | 'agents';
export type IntentState = 'idle' | 'typing' | 'analyst' | 'writer' | 'planner' | 'thinking' | 'responding';
export type ThinkingPhase = 'gathering' | 'analyzing' | 'coding' | 'writing' | 'searching' | 'planning' | 'reasoning' | 'processing' | 'idle';

export interface LiveFileEdit {
  path: string;
  name: string;
  type: string;
  oldContent: string;
  newContent: string;
  isPdf: boolean;
  timestamp: number;
  messageId?: string | null;
}

export interface TaskItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details?: string;
}

export interface Artifact {
  identifier: string;
  type: string;
  title: string;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  timestamp: number;
  attachments?: { name: string; type: string; content: string; preview?: string }[];
  artifacts?: Artifact[];
  sources?: (string | { url: string; title?: string })[];
  model?: string;
  thinking?: boolean;
  thoughts?: string;
  tokenUsage?: { input: number; output: number; total: number };
  parentId?: string;
  branchId?: string;
  agentId?: string;
  agentName?: string;
  agentTask?: string;
  agentIcon?: string;
  tasks?: TaskItem[];
  source?: 'on-device' | 'cloud';
  /** True when the provider hit max_tokens — UI shows a "tap to continue" chip. */
  wasTruncated?: boolean;
  /** Tappable follow-up prompts suggested after this message completes. */
  suggestions?: string[];
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
  
  if (!Array.isArray(nodes)) return [newNode];
  
  if (msg.parentId) {
    return nodes.map(node => {
      if (!node || !node.message) return node;
      if (node.message.id === msg.parentId) {
        return { ...node, children: [...(node.children || []), newNode] };
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        return { ...node, children: addMessageToTree(node.children, msg, branchId) };
      }
      return node;
    });
  }
  
  return [...nodes, newNode];
}

function updateMessageInTree(nodes: MessageNode[], msgId: string, content: string, thoughts?: string): MessageNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(node => {
    if (node.message.id === msgId) {
      return { ...node, message: { ...node.message, content, ...(thoughts !== undefined ? { thoughts } : {}) } };
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return { ...node, children: updateMessageInTree(node.children, msgId, content, thoughts) };
    }
    return node;
  });
}

function updateArtifactsInTree(nodes: MessageNode[], msgId: string, artifacts: Artifact[]): MessageNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(node => {
    if (node.message.id === msgId) {
      return { ...node, message: { ...node.message, artifacts: [...(node.message.artifacts || []), ...artifacts] } };
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return { ...node, children: updateArtifactsInTree(node.children, msgId, artifacts) };
    }
    return node;
  });
}

function updateTasksInTree(nodes: MessageNode[], msgId: string, tasks: TaskItem[]): MessageNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(node => {
    if (node.message.id === msgId) {
      return { ...node, message: { ...node.message, tasks } };
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      return { ...node, children: updateTasksInTree(node.children, msgId, tasks) };
    }
    return node;
  });
}

function findMessageInTree(nodes: MessageNode[], msgId: string): MessageNode | null {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (!node || !node.message) continue;
    if (node.message.id === msgId) return node;
    if (Array.isArray(node.children) && node.children.length > 0) {
      const found = findMessageInTree(node.children, msgId);
      if (found) return found;
    }
  }
  return null;
}

function getPathToMessage(nodes: MessageNode[], msgId: string): MessageNode[] {
  const path: MessageNode[] = [];
  if (!Array.isArray(nodes)) return path;
  
  function dfs(node: MessageNode): boolean {
    if (!node || !node.message) return false;
    path.push(node);
    if (node.message.id === msgId) return true;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (dfs(child)) return true;
      }
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
  if (!Array.isArray(nodes) || !Array.isArray(path) || path.length === 0) return [];
  
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
  if (!Array.isArray(nodes)) return result;
  
  function traverse(node: MessageNode) {
    if (!node || !node.message) return;
    if (node.message.branchId === branchId || branchId === 'all') {
      result.push(node.message);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
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
  profilePictureUri?: string;
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
  showModelSwitcher: boolean;
  showEngine: boolean;
  moduleHistory: Module[];
  sharedData: Record<string, unknown>;
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
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
  deepSearch: boolean;
  reactions: Record<string, { value: 'up' | 'down'; snippet: string }>;
  extThinking: boolean;
  handsOff: boolean;
  localVision: boolean;
  localSummarize: boolean;
  localTranslate: boolean;
  onDeviceMode: boolean;
  responseCache: boolean;
  inputGuardrails: boolean;
  outputValidation: boolean;
  smartFallback: boolean;
  multiProvider: boolean;
  hapticFeedback: boolean;
  fullScreenMode: boolean;
  toggleFullScreenMode: () => void;
  thinkingPhase: ThinkingPhase;
  liveThoughts: Record<string, string>;
  showThoughts: string[];
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
  theme: 'dark' | 'light' | 'system' | 'obsidian-aurora';
  connectionStatus: 'online' | 'offline';
  providerConnected: boolean;
  currentTool: string | null;
  generationState: { active: boolean; module: 'chat' | 'agents' | null; sessionId: string | null; messageId: string | null; abortSignal?: AbortSignal };
  generationControllers: Map<string, AbortController>;
  showCircleSearch: boolean;
  setShowCircleSearch: (v: boolean) => void;
  pendingCircleImage: string | null;
  setPendingCircleImage: (v: string | null) => void;
  pendingInput: string | null;
  pendingInputAutoSend: boolean;
  setPendingInput: (v: string | null, opts?: { autoSend?: boolean }) => void;
  pendingFiles: { name: string; type: string; content: string; preview?: string }[];
  setPendingFiles: (v: { name: string; type: string; content: string; preview?: string }[]) => void;
  pendingAction: { type: string; data: Record<string, unknown> } | null;
  pendingApiKeyRequest: { providerId: string; description: string } | null;
  setPendingAction: (v: { type: string; data: Record<string, unknown> } | null) => void;
  setPendingApiKeyRequest: (v: { providerId: string; description: string } | null) => void;
  deepLinkQueue: string[];
  setDeepLinkQueue: (v: string[]) => void;
  liveFileEdit: LiveFileEdit | null;
  setLiveFileEdit: (edit: LiveFileEdit | null) => void;

  setModule: (module: Module) => void;
  goBack: () => boolean;
  setShowEngine: (v: boolean) => void;
  setGenerationState: (state: { active: boolean; module: 'chat' | 'agents' | null; sessionId: string | null; messageId: string | null; abortSignal?: AbortSignal }) => void;
  setCurrentTool: (tool: string | null) => void;
  registerGenerationController: (key: string, controller: AbortController) => void;
  unregisterGenerationController: (key: string) => void;
  abortGeneration: (key: string) => void;
  abortAllGenerations: () => void;
  setClarification: (c: Clarification | null) => void;
  setIntentState: (state: IntentState) => void;
  setShowTerminal: (show: boolean) => void;
  setShowModelSwitcher: (show: boolean) => void;
  setWebSearch: (enabled: boolean) => void;
  setDeepSearch: (enabled: boolean) => void;
  setReaction: (msgId: string, value: 'up' | 'down', snippet: string) => void;
  setExtThinking: (enabled: boolean) => void;
  setHandsOff: (enabled: boolean) => void;
  setLocalVision: (enabled: boolean) => void;
  setLocalSummarize: (enabled: boolean) => void;
  setLocalTranslate: (enabled: boolean) => void;
  setOnDeviceMode: (enabled: boolean) => void;
  setResponseCache: (enabled: boolean) => void;
  setInputGuardrails: (enabled: boolean) => void;
  setOutputValidation: (enabled: boolean) => void;
  setSmartFallback: (enabled: boolean) => void;
  setMultiProvider: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setThinkingPhase: (phase: ThinkingPhase) => void;
  setLiveThoughts: (thoughts: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setShowThoughts: (thoughts: string[]) => void;
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
  updateMessageArtifacts: (sessionId: string, msgId: string, artifacts: Artifact[]) => void;
  updateMessageTasks: (sessionId: string, msgId: string, tasks: TaskItem[]) => void;
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
  restoreSession: (id: string) => void;
  setSkill: (id: string | null) => void;
  addSkill: (skill: Skill) => void;
  removeSkill: (id: string) => void;
  setCustomInstructions: (text: string) => void;
  togglePinnedMemory: (id: string) => void;
  addConsoleLog: (log: { type: 'thought' | 'tool' | 'result' | 'error'; content: string }) => void;
  setShowConsole: (show: boolean) => void;
  clearConsole: () => void;
  setShowProtocols: (show: boolean) => void;
  buildMode: boolean;
  setBuildMode: (v: boolean) => void;
  buildSessionId: string | null;
  buildPreviewUrl: string | null;
  setBuildPreview: (url: string | null) => void;
  sandboxEnvReady: boolean | null;
  setSandboxEnvReady: (v: boolean | null) => void;
  longRunningMode: boolean;
  autoModelUnload: boolean;
  setLongRunningMode: (v: boolean) => void;
  setAutoModelUnload: (v: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'system' | 'obsidian-aurora') => void;
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
      showModelSwitcher: false,
      showEngine: false,
      moduleHistory: [],
      sharedData: {},
      sessions: [],
      archivedSessions: [],
      activeSessionId: null,
      scheduledTasks: [],
      userProfile: { name: '', bio: '', goals: '', profilePictureUri: '' },
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
      deepSearch: false,
      reactions: {},
      extThinking: false,
      handsOff: false,
      localVision: false,
      localSummarize: true,
      localTranslate: false,
      onDeviceMode: false,
      responseCache: true,
      inputGuardrails: true,
      outputValidation: true,
      smartFallback: true,
      multiProvider: false,
      hapticFeedback: true,
      thinkingPhase: 'idle',
      liveThoughts: {},
      showThoughts: [],
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
      generationState: { active: false, module: null, sessionId: null, messageId: null },
      generationControllers: new Map(),
      showCircleSearch: false,
      pendingCircleImage: null,
      pendingInput: null,
      pendingInputAutoSend: true,
      pendingFiles: [],
      pendingAction: null,
      pendingApiKeyRequest: null,
      deepLinkQueue: [],
      liveFileEdit: null,
      buildMode: false,
      buildSessionId: null,
      buildPreviewUrl: null,
      sandboxEnvReady: null,
      longRunningMode: (() => { try { return localStorage.getItem('gia-long-running') === 'true'; } catch { return false; } })(),
      autoModelUnload: (() => { try { return localStorage.getItem('gia-auto-model-unload') !== 'false'; } catch { return true; } })(),
      fullScreenMode: false,

      setBuildMode: (v) => set((s) => ({ buildMode: v, buildSessionId: v ? s.activeSessionId : s.buildSessionId })),
      setBuildPreview: (url) => set({ buildPreviewUrl: url }),
      setSandboxEnvReady: (v) => set({ sandboxEnvReady: v }),
      setModule: (module) => set((s) => {
        if (s.currentModule === module) return {};
        // Fire-and-forget: dynamic import avoids a circular dependency, since
        // HapticService itself reads this store's hapticFeedback flag.
        import('../services/HapticService').then(m => m.default.selection());
        // Preserve context across module switches so the next module can pick
        // up where the previous left off (e.g. chat → planner with context).
        const prevModule = s.currentModule;
        const contextPayload: Record<string, unknown> = {
          prevModule,
          timestamp: Date.now(),
          activeSessionId: s.activeSessionId,
          ...(prevModule === 'chat' ? { lastTopic: s.sessions.find(se => se.id === s.activeSessionId)?.title || '' } : {}),
        };
        // Record navigation history (capped) so the hardware Back button can
        // return to the previous module on mobile.
        const history = s.moduleHistory[s.moduleHistory.length - 1] === prevModule
          ? s.moduleHistory
          : [...s.moduleHistory, prevModule].slice(-20);
        return { currentModule: module, moduleHistory: history, sharedData: { ...s.sharedData, lastModuleSwitch: contextPayload } };
      }),
      goBack: () => {
        const s = get();
        if (s.moduleHistory.length === 0) return false;
        const prev = s.moduleHistory[s.moduleHistory.length - 1];
        import('../services/HapticService').then(m => m.default.selection());
        set((st) => ({ currentModule: prev, moduleHistory: st.moduleHistory.slice(0, -1) }));
        return true;
      },
      setShowEngine: (v) => set({ showEngine: v }),
      setGenerationState: (generationState) => set((s) => {
        // Single choke point for all 5 "generation finished" call sites (chat
        // streaming, agents, errors, aborts) rather than touching each one.
        if (s.generationState.active && !generationState.active) {
          import('../services/HapticService').then(m => m.default.notification('success'));
        }
        return { generationState };
      }),
      registerGenerationController: (key, controller) => set((s) => {
        const newControllers = new Map(s.generationControllers);
        newControllers.set(key, controller);
        return { generationControllers: newControllers };
      }),
      unregisterGenerationController: (key) => set((s) => {
        const newControllers = new Map(s.generationControllers);
        newControllers.delete(key);
        return { generationControllers: newControllers };
      }),
      abortGeneration: (key) => {
        const controller = useGiaStore.getState().generationControllers.get(key);
        if (controller) controller.abort();
      },
      abortAllGenerations: () => {
        useGiaStore.getState().generationControllers.forEach(c => c.abort());
      },
      setCurrentTool: (tool) => set({ currentTool: tool }),
      setClarification: (c) => set({ clarification: c }),
      setIntentState: (state) => set({ intentState: state }),
      setShowTerminal: (show) => set({ showTerminal: show }),
      setShowModelSwitcher: (show) => set({ showModelSwitcher: show }),
      setWebSearch: (enabled) => set({ webSearch: enabled }),
      setDeepSearch: (enabled) => set({ deepSearch: enabled }),
      setReaction: (msgId, value, snippet) => set(s => {
        const next = { ...s.reactions };
        const wasSet = next[msgId]?.value === value;
        if (wasSet) delete next[msgId];
        else next[msgId] = { value, snippet };

        const mem = useMemoryStore.getState();
        const prevKey = value === 'up' ? FEEDBACK_KEYS.down : FEEDBACK_KEYS.up;
        const prevEntry = mem.getMemories().find(m => m.key === prevKey);
        if (prevEntry) mem.deleteMemory(prevEntry.id);

        if (!wasSet) {
          mem.addMemory({
            key: FEEDBACK_KEYS[value],
            value: value === 'up'
              ? `Preferred response style — match this: "${snippet}"`
              : `Disliked response style — avoid this: "${snippet}"`,
            category: value === 'up' ? 'preference' : 'correction',
            tier: 'semantic',
            confidence: 0.85,
          });
        }

        return { reactions: next };
      }),
      setExtThinking: (enabled) => set({ extThinking: enabled }),
      setHandsOff: (enabled) => set({ handsOff: enabled }),
      setLocalVision: (enabled) => set({ localVision: enabled }),
      setLocalSummarize: (enabled) => set({ localSummarize: enabled }),
      setLocalTranslate: (enabled) => set({ localTranslate: enabled }),
      setOnDeviceMode: (enabled) => set({ onDeviceMode: enabled }),
      setResponseCache: (enabled) => set({ responseCache: enabled }),
      setInputGuardrails: (enabled) => set({ inputGuardrails: enabled }),
      setOutputValidation: (enabled) => set({ outputValidation: enabled }),
      setSmartFallback: (enabled) => set({ smartFallback: enabled }),
      setMultiProvider: (enabled) => set({ multiProvider: enabled }),
      setHapticFeedback: (enabled) => set({ hapticFeedback: enabled }),
      setThinkingPhase: (phase) => set({ thinkingPhase: phase }),
      setLiveThoughts: (thoughts) => set((state) => ({
        liveThoughts: typeof thoughts === 'function' ? thoughts(state.liveThoughts) : thoughts
      })),
      setShowThoughts: (thoughts: string[]) => set({ showThoughts: thoughts }),
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
      setPendingInput: (v, opts) => set({ pendingInput: v, pendingInputAutoSend: opts?.autoSend ?? true }),
      setPendingFiles: (v) => set({ pendingFiles: v }),
      setPendingAction: (v) => set({ pendingAction: v }),
      setPendingApiKeyRequest: (v) => set({ pendingApiKeyRequest: v }),
      setDeepLinkQueue: (v) => set({ deepLinkQueue: v }),
      setLiveFileEdit: (edit) => set({ liveFileEdit: edit }),
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
      setActiveSession: (id) => set({
        activeSessionId: id,
        intentState: 'idle',
        thinkingPhase: 'idle',
        currentTool: null,
        clarification: null,
        consoleLogs: [],
      }),

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

      updateMessageArtifacts: (sessionId, msgId, artifacts) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: updateArtifactsInTree(sess.messages, msgId, artifacts) }
              : sess
          ),
        })),

      updateMessageTasks: (sessionId, msgId, tasks) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, messages: updateTasksInTree(sess.messages, msgId, tasks) }
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
        if (!sess || !Array.isArray(sess.messages)) return [];
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
        set((s) => {
          const now = Date.now();
          const last = s.notifications[0];
          // Dedupe rapid repeats of the same message (e.g. repeated taps on a
          // failing toggle) — refresh its timestamp so it stays "just now"
          // instead of stacking identical cards.
          if (last && last.message === msg && now - last.ts < 8000) {
            return { notifications: [{ ...last, ts: now }, ...s.notifications.slice(1, 9)] };
          }
          return { notifications: [{ id: genId(), message: msg, ts: now }, ...s.notifications.slice(0, 9)] };
        }),
      clearNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      addExamResult: (r) => set((s) => ({ examHistory: [r, ...s.examHistory].slice(0, 50) })),
      clearExamHistory: () => set({ examHistory: [] }),
      hibernateSessions: () => {
        const { sessions } = get();
        const active = sessions.find(s => s.id === get().activeSessionId);
        if (!active) return;
        const inactive = sessions.filter(s => s.id !== active.id && s.messages.length > 0);
        if (inactive.length <= 5) return;
        // Archive older sessions to keep the live working set small — but
        // NEVER destroy their content. Full messages are preserved in
        // archivedSessions so the user can restore them later from the
        // chat history panel. (Previously this truncated history to a
        // 100-char stub, irreversibly losing every older conversation.)
        const toArchive = inactive.slice(0, inactive.length - 5);
        const archiveIds = new Set(toArchive.map(s => s.id));
        set((s) => ({
          sessions: s.sessions.filter(sess => !archiveIds.has(sess.id)),
          archivedSessions: [...toArchive, ...s.archivedSessions],
        }));
      },
      restoreSession: (id) => {
        const sess = get().archivedSessions.find(s => s.id === id);
        if (!sess) return;
        set((s) => ({
          archivedSessions: s.archivedSessions.filter(x => x.id !== id),
          sessions: [sess, ...s.sessions],
          activeSessionId: id,
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
      toggleFullScreenMode: () => set((s) => ({ fullScreenMode: !s.fullScreenMode })),
    }),
    {
      name: 'gia-store-v3',
      version: 3,
      storage: createJSONStorage(() => idbStorage),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3 && persistedState && typeof persistedState === 'object') {
          const state = persistedState as Record<string, unknown>;
          if (Array.isArray(state.sessions)) {
            state.sessions = state.sessions.map((sess: unknown) => {
              if (!sess || typeof sess !== 'object') return sess;
              const s = sess as Record<string, unknown>;
              if (Array.isArray(s.messages)) {
                const hasTreeStructure = s.messages.some((m: unknown) =>
                  m && typeof m === 'object' && 'children' in (m as Record<string, unknown>)
                );
                if (!hasTreeStructure) {
                  const branchId = typeof s.currentBranchId === 'string' && s.currentBranchId
                    ? s.currentBranchId
                    : `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                  s.messages = s.messages.map((msg: unknown) => {
                    if (!msg || typeof msg !== 'object') return msg;
                    const m = msg as Record<string, unknown>;
                    return {
                      message: {
                        ...m,
                        branchId,
                      },
                      children: [],
                    };
                  });
                  s.currentBranchId = branchId;
                  s.branches = s.branches || { [branchId]: { id: branchId, name: 'Main', createdAt: Date.now() } };
                }
              }
              return s;
            });
          }
        }
        return persistedState as Record<string, unknown>;
      },
      partialize: (s) => ({
        sessions: s.sessions,
        archivedSessions: s.archivedSessions,
        activeSessionId: s.activeSessionId,
        scheduledTasks: s.scheduledTasks,
        userProfile: s.userProfile,
        skills: s.skills,
        activeSkillId: s.activeSkillId,
        examHistory: s.examHistory,
        webSearch: s.webSearch,
        deepSearch: s.deepSearch,
        reactions: s.reactions,
        extThinking: s.extThinking,
        handsOff: s.handsOff,
        localVision: s.localVision,
        localSummarize: s.localSummarize,
        responseCache: s.responseCache,
        inputGuardrails: s.inputGuardrails,
        outputValidation: s.outputValidation,
        smartFallback: s.smartFallback,
        multiProvider: s.multiProvider,
        hapticFeedback: s.hapticFeedback,
        customInstructions: s.customInstructions,
        theme: s.theme,
        wakeWord: s.wakeWord,
        keepListening: s.keepListening,
        autoStartWakeWord: s.autoStartWakeWord,
        voiceLanguage: s.voiceLanguage,
        nativeWakeWord: s.nativeWakeWord,
        nativeSensitivity: s.nativeSensitivity,
        wakeWordAccessKey: s.wakeWordAccessKey,
        useWhisper: s.useWhisper,
        buildMode: s.buildMode,
        buildSessionId: s.buildSessionId,
        buildPreviewUrl: s.buildPreviewUrl,
      }),
      onRehydrateStorage: () => (state) => {
        // A stream interrupted by a crash / tab close can persist a message
        // with thinking:true forever. Nothing is generating on reload, so any
        // in-flight flag is stale — clear it so the UI doesn't show a dead spinner.
        if (!state) return;
        const clearThinking = (sess: typeof state.sessions[number]) => ({
          ...sess,
          messages: sess.messages.map((m) =>
            m.message.thinking ? { ...m, message: { ...m.message, thinking: false } } : m
          ),
        });
        state.sessions = state.sessions.map(clearThinking);
        state.archivedSessions = (state.archivedSessions || []).map(clearThinking);
      },
    }
  )
);
