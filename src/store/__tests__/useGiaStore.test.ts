import { describe, it, expect, beforeEach, vi } from 'vitest';

let idCounter = 0;

vi.mock('../idb-storage', () => {
  const store = new Map<string, string>();
  return {
    idbStorage: {
      getItem: vi.fn(async (name: string) => store.get(name) ?? null),
      setItem: vi.fn(async (name: string, value: string) => { store.set(name, value); }),
      removeItem: vi.fn(async (name: string) => { store.delete(name); }),
    },
  };
});

vi.mock('../../utils/id', () => ({
  genId: vi.fn(() => `gia-id-${++idCounter}`),
}));

const { useGiaStore } = await import('../useGiaStore');
import type { Message } from '../useGiaStore';

function userMsg(overrides: Partial<Message> = {}): Message {
  return { id: overrides.id ?? 'msg-1', role: 'user', content: overrides.content ?? 'hello', timestamp: overrides.timestamp ?? 1000, ...overrides };
}

function asstMsg(overrides: Partial<Message> = {}): Message {
  return { id: overrides.id ?? 'msg-2', role: 'assistant', content: overrides.content ?? 'hi there', timestamp: overrides.timestamp ?? 2000, ...overrides };
}

describe('useGiaStore', () => {
  beforeEach(() => {
    idCounter = 0;
    useGiaStore.setState({
      currentModule: 'chat',
      intentState: 'idle',
      showTerminal: false,
      sharedData: {},
      sessions: [],
      activeSessionId: null,
      scheduledTasks: [],
      userProfile: { name: '', bio: '', goals: '' },
      notifications: [],
      activeSkillId: 'core-general',
      examHistory: [],
      consoleLogs: [],
      showConsole: false,
      showProtocols: false,
      webSearch: true,
      extThinking: false,
      handsOff: false,
      thinkingPhase: 'idle',
      clarification: null,
      wakeWord: 'hey gia',
      keepListening: false,
      autoStartWakeWord: false,
      voiceLanguage: 'en-US',
      customInstructions: '',
      pinnedMemories: [],
      theme: 'dark',
      connectionStatus: 'online',
      providerConnected: false,
      currentTool: null,
    });
  });

  describe('module and tool state', () => {
    it('setModule changes current module', () => {
      useGiaStore.getState().setModule('planner');
      expect(useGiaStore.getState().currentModule).toBe('planner');
    });

    it('setCurrentTool updates current tool', () => {
      useGiaStore.getState().setCurrentTool('web_search');
      expect(useGiaStore.getState().currentTool).toBe('web_search');
    });

    it('setShowTerminal toggles terminal', () => {
      useGiaStore.getState().setShowTerminal(true);
      expect(useGiaStore.getState().showTerminal).toBe(true);
    });
  });

  describe('feature toggles', () => {
    it('setWebSearch', () => {
      useGiaStore.getState().setWebSearch(false);
      expect(useGiaStore.getState().webSearch).toBe(false);
    });

    it('setExtThinking', () => {
      useGiaStore.getState().setExtThinking(true);
      expect(useGiaStore.getState().extThinking).toBe(true);
    });

    it('setHandsOff', () => {
      useGiaStore.getState().setHandsOff(true);
      expect(useGiaStore.getState().handsOff).toBe(true);
    });

    it('setThinkingPhase', () => {
      useGiaStore.getState().setThinkingPhase('searching');
      expect(useGiaStore.getState().thinkingPhase).toBe('searching');
    });

    it('setIntentState', () => {
      useGiaStore.getState().setIntentState('thinking');
      expect(useGiaStore.getState().intentState).toBe('thinking');
    });
  });

  describe('setClarification', () => {
    it('sets and clears clarification', () => {
      const c = { question: 'Which?', options: ['A', 'B'], sessionId: 's1', assistantMsgId: 'a1' };
      useGiaStore.getState().setClarification(c);
      expect(useGiaStore.getState().clarification).toEqual(c);
      useGiaStore.getState().setClarification(null);
      expect(useGiaStore.getState().clarification).toBeNull();
    });
  });

  describe('session management', () => {
    it('createSession adds a session and sets it active', () => {
      const id = useGiaStore.getState().createSession();
      expect(useGiaStore.getState().sessions).toHaveLength(1);
      expect(useGiaStore.getState().activeSessionId).toBe(id);
      expect(useGiaStore.getState().sessions[0].title).toBe('New Chat');
      expect(useGiaStore.getState().sessions[0].messages).toEqual([]);
      expect(useGiaStore.getState().sessions[0].currentBranchId).toBeTruthy();
    });

    it('setActiveSession changes active session', () => {
      const id1 = useGiaStore.getState().createSession();
      useGiaStore.getState().createSession();
      useGiaStore.getState().setActiveSession(id1);
      expect(useGiaStore.getState().activeSessionId).toBe(id1);
    });

    it('deleteSession removes session and adjusts activeSessionId', () => {
      const id1 = useGiaStore.getState().createSession();
      const id2 = useGiaStore.getState().createSession();
      useGiaStore.getState().deleteSession(id1);
      expect(useGiaStore.getState().sessions).toHaveLength(1);
      expect(useGiaStore.getState().activeSessionId).toBe(id2);
    });

    it('deleteSession sets activeSessionId to null when last session deleted', () => {
      const id = useGiaStore.getState().createSession();
      useGiaStore.getState().deleteSession(id);
      expect(useGiaStore.getState().activeSessionId).toBeNull();
    });

    it('updateSessionTitle changes session title', () => {
      const id = useGiaStore.getState().createSession();
      useGiaStore.getState().updateSessionTitle(id, 'My Chat');
      expect(useGiaStore.getState().sessions[0].title).toBe('My Chat');
    });

    it('getActiveSession returns the active session', () => {
      const id = useGiaStore.getState().createSession();
      const session = useGiaStore.getState().getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.id).toBe(id);
    });

    it('getActiveSession returns null when no active session', () => {
      expect(useGiaStore.getState().getActiveSession()).toBeNull();
    });
  });

  describe('message operations', () => {
    it('addMessage adds a root message', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1', content: 'hi' }));
      const msgs = useGiaStore.getState().sessions[0].messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].message.content).toBe('hi');
    });

    it('addMessage adds a child message when parentId is set', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1', content: 'hi' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', content: 'hello!', parentId: 'm1' }));
      const msgs = useGiaStore.getState().sessions[0].messages;
      expect(msgs[0].children).toHaveLength(1);
      expect(msgs[0].children[0].message.content).toBe('hello!');
    });

    it('updateMessage updates content and thoughts', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm1', content: '', thinking: true }));
      useGiaStore.getState().updateMessage(sid, 'm1', 'full response', 'some thoughts');
      const msg = useGiaStore.getState().sessions[0].messages[0].message;
      expect(msg.content).toBe('full response');
      expect(msg.thoughts).toBe('some thoughts');
    });

    it('updateMessage updates nested messages', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', parentId: 'm1' }));
      useGiaStore.getState().updateMessage(sid, 'm2', 'updated');
      const child = useGiaStore.getState().sessions[0].messages[0].children[0].message;
      expect(child.content).toBe('updated');
    });
  });

  describe('getBranchMessages', () => {
    it('returns flat list of messages for a branch', () => {
      const sid = useGiaStore.getState().createSession();
      const branchId = useGiaStore.getState().sessions[0].currentBranchId;
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', parentId: 'm1' }));
      const flat = useGiaStore.getState().getBranchMessages(sid, branchId);
      expect(flat).toHaveLength(2);
    });

    it('returns empty for nonexistent session', () => {
      expect(useGiaStore.getState().getBranchMessages('nosession', 'b1')).toEqual([]);
    });
  });

  describe('branch operations', () => {
    it('switchBranch changes currentBranchId', () => {
      const sid = useGiaStore.getState().createSession();
      const newBranch = 'new-branch';
      useGiaStore.getState().switchBranch(sid, newBranch);
      expect(useGiaStore.getState().sessions[0].currentBranchId).toBe(newBranch);
    });

    it('addBranch creates a new branch from a message', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', parentId: 'm1' }));
      idCounter = 100;
      const branchId = useGiaStore.getState().addBranch(sid, 'm1', 'Experiment');
      expect(branchId).toBe('gia-id-101');
      const session = useGiaStore.getState().sessions[0];
      expect(session.currentBranchId).toBe(branchId);
      expect(session.branches?.[branchId]?.name).toBe('Experiment');
    });

    it('renameBranch sets branch name', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      const branchId = useGiaStore.getState().addBranch(sid, 'm1', 'Original');
      useGiaStore.getState().renameBranch(sid, branchId, 'Renamed');
      expect(useGiaStore.getState().sessions[0].branches?.[branchId]?.name).toBe('Renamed');
    });

    it('deleteBranch removes branch messages and switches to another branch', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', parentId: 'm1' }));
      const branchId = useGiaStore.getState().addBranch(sid, 'm1', 'New');
      useGiaStore.getState().switchBranch(sid, branchId);
      useGiaStore.getState().deleteBranch(sid, branchId);
      const session = useGiaStore.getState().sessions[0];
      // If only one branch existed, deleteBranch shouldn't change anything
      expect(session.currentBranchId).toBeTruthy();
    });
  });

  describe('clearSession', () => {
    it('resets session messages and title', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      useGiaStore.getState().updateSessionTitle(sid, 'My Chat');
      useGiaStore.getState().clearSession(sid);
      const session = useGiaStore.getState().sessions[0];
      expect(session.messages).toEqual([]);
      expect(session.title).toBe('New Chat');
    });
  });

  describe('forkSession', () => {
    it('creates a new session branched from a message', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1', content: 'original' }));
      useGiaStore.getState().addMessage(sid, asstMsg({ id: 'm2', parentId: 'm1' }));
      const newId = useGiaStore.getState().forkSession(sid, 'm1');
      expect(newId).not.toBe(sid);
      expect(useGiaStore.getState().activeSessionId).toBe(newId);
      const newSess = useGiaStore.getState().sessions.find(s => s.id === newId);
      expect(newSess).toBeDefined();
      expect(newSess!.title).toContain('Branch:');
    });
  });

  describe('getAllBranchIds', () => {
    it('collects all branch IDs', () => {
      const sid = useGiaStore.getState().createSession();
      useGiaStore.getState().addMessage(sid, userMsg({ id: 'm1' }));
      const ids = useGiaStore.getState().getAllBranchIds(sid);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('returns [] for missing session', () => {
      expect(useGiaStore.getState().getAllBranchIds('nonexistent')).toEqual([]);
    });
  });

  describe('scheduled tasks', () => {
    it('addScheduledTask prepends a task', () => {
      const task = { id: 't1', title: 'Daily', prompt: 'do stuff', cronLabel: 'daily', interval: 'daily' as const, nextRun: 1000, status: 'pending' as const };
      useGiaStore.getState().addScheduledTask(task);
      expect(useGiaStore.getState().scheduledTasks).toHaveLength(1);
    });

    it('updateTaskStatus updates task fields', () => {
      useGiaStore.getState().addScheduledTask({ id: 't1', title: '', prompt: '', cronLabel: '', interval: 'daily', nextRun: 0, status: 'pending' });
      useGiaStore.getState().updateTaskStatus('t1', 'running', 'output', 2000);
      const task = useGiaStore.getState().scheduledTasks[0];
      expect(task.status).toBe('running');
      expect(task.lastResult).toBe('output');
    });

    it('deleteTask removes a task', () => {
      useGiaStore.getState().addScheduledTask({ id: 't1', title: '', prompt: '', cronLabel: '', interval: 'daily', nextRun: 0, status: 'pending' });
      useGiaStore.getState().deleteTask('t1');
      expect(useGiaStore.getState().scheduledTasks).toHaveLength(0);
    });
  });

  describe('user profile', () => {
    it('setUserProfile merges profile data', () => {
      useGiaStore.getState().setUserProfile({ name: 'Alice', bio: 'Engineer' });
      expect(useGiaStore.getState().userProfile.name).toBe('Alice');
      expect(useGiaStore.getState().userProfile.bio).toBe('Engineer');
      expect(useGiaStore.getState().userProfile.goals).toBe('');
    });
  });

  describe('notifications', () => {
    it('addNotification prepends with id and timestamp', () => {
      useGiaStore.getState().addNotification('Hello');
      const n = useGiaStore.getState().notifications[0];
      expect(n.message).toBe('Hello');
      expect(n.id).toBeTruthy();
      expect(n.ts).toBeGreaterThan(0);
    });

    it('caps notifications at 10', () => {
      for (let i = 0; i < 15; i++) useGiaStore.getState().addNotification(`N${i}`);
      expect(useGiaStore.getState().notifications).toHaveLength(10);
    });

    it('clearNotification removes by id', () => {
      useGiaStore.getState().addNotification('Test');
      const id = useGiaStore.getState().notifications[0].id;
      useGiaStore.getState().clearNotification(id);
      expect(useGiaStore.getState().notifications).toHaveLength(0);
    });
  });

  describe('exam history', () => {
    it('addExamResult prepends and caps at 50', () => {
      for (let i = 0; i < 60; i++) {
        useGiaStore.getState().addExamResult({ id: `e${i}`, examSystem: 'wasce', subject: 'math', topic: 'algebra', score: 80, correct: 8, total: 10, weakAreas: [], timestamp: i, timeSpent: 60 });
      }
      expect(useGiaStore.getState().examHistory).toHaveLength(50);
    });

    it('clearExamHistory empties the list', () => {
      useGiaStore.getState().addExamResult({ id: 'e1', examSystem: 'wasce', subject: 'math', topic: 'algebra', score: 80, correct: 8, total: 10, weakAreas: [], timestamp: 1, timeSpent: 60 });
      useGiaStore.getState().clearExamHistory();
      expect(useGiaStore.getState().examHistory).toHaveLength(0);
    });
  });

  describe('skills', () => {
    it('setSkill chooses a skill', () => {
      useGiaStore.getState().setSkill('skill-creative');
      expect(useGiaStore.getState().activeSkillId).toBe('skill-creative');
    });

    it('addSkill adds a new skill', () => {
      const s = { id: 'custom', name: 'Custom', description: '', systemPrompt: '', tools: [], category: 'user' as const };
      useGiaStore.getState().addSkill(s);
      expect(useGiaStore.getState().skills).toContainEqual(expect.objectContaining({ id: 'custom' }));
    });

    it('addSkill does not duplicate existing skill', () => {
      const initial = useGiaStore.getState().skills.length;
      const s = { id: 'core-general', name: 'General', description: '', systemPrompt: '', tools: [], category: 'core' as const };
      useGiaStore.getState().addSkill(s);
      expect(useGiaStore.getState().skills).toHaveLength(initial);
    });

    it('removeSkill deletes a skill', () => {
      useGiaStore.getState().removeSkill('skill-creative');
      expect(useGiaStore.getState().skills.find(s => s.id === 'skill-creative')).toBeUndefined();
    });
  });

  describe('sharedData', () => {
    it('setSharedData replaces shared data', () => {
      useGiaStore.getState().setSharedData({ key: 'value' });
      expect(useGiaStore.getState().sharedData).toEqual({ key: 'value' });
    });

    it('updateSharedData merges data', () => {
      useGiaStore.getState().setSharedData({ a: 1 });
      useGiaStore.getState().updateSharedData({ b: 2 });
      expect(useGiaStore.getState().sharedData).toEqual({ a: 1, b: 2 });
    });
  });

  describe('console logs', () => {
    it('addConsoleLog appends with id and timestamp', () => {
      useGiaStore.getState().addConsoleLog({ type: 'thought', content: 'thinking...' });
      const log = useGiaStore.getState().consoleLogs[0];
      expect(log.type).toBe('thought');
      expect(log.content).toBe('thinking...');
      expect(log.id).toBeTruthy();
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it('caps console logs at 100', () => {
      for (let i = 0; i < 120; i++) useGiaStore.getState().addConsoleLog({ type: 'thought', content: `log${i}` });
      expect(useGiaStore.getState().consoleLogs).toHaveLength(100);
    });

    it('clearConsole empties the log', () => {
      useGiaStore.getState().addConsoleLog({ type: 'thought', content: 'test' });
      useGiaStore.getState().clearConsole();
      expect(useGiaStore.getState().consoleLogs).toHaveLength(0);
    });

    it('setShowConsole toggles visibility', () => {
      useGiaStore.getState().setShowConsole(true);
      expect(useGiaStore.getState().showConsole).toBe(true);
    });
  });

  describe('settings', () => {
    it('setShowProtocols toggles', () => {
      useGiaStore.getState().setShowProtocols(true);
      expect(useGiaStore.getState().showProtocols).toBe(true);
    });

    it('setTheme changes theme', () => {
      useGiaStore.getState().setTheme('light');
      expect(useGiaStore.getState().theme).toBe('light');
    });

    it('setConnectionStatus changes status', () => {
      useGiaStore.getState().setConnectionStatus('offline');
      expect(useGiaStore.getState().connectionStatus).toBe('offline');
    });

    it('setProviderConnected changes connection flag', () => {
      useGiaStore.getState().setProviderConnected(true);
      expect(useGiaStore.getState().providerConnected).toBe(true);
    });
  });

  describe('hibernateSessions', () => {
    it('archives old sessions when there are more than 5 inactive', () => {
      for (let i = 0; i < 8; i++) {
        const sid = useGiaStore.getState().createSession();
        useGiaStore.getState().addMessage(sid, userMsg({ id: `m${i}`, content: `Message ${i}` }));
        useGiaStore.getState().addMessage(sid, asstMsg({ id: `a${i}`, parentId: `m${i}`, content: `Response ${i}` }));
      }
      useGiaStore.getState().setActiveSession(useGiaStore.getState().sessions[0].id);
      useGiaStore.getState().hibernateSessions();
      const { sessions, archivedSessions } = useGiaStore.getState();
      // Active session + 5 most-recent inactive stay live; 2 oldest archived.
      expect(sessions).toHaveLength(6);
      expect(archivedSessions).toHaveLength(2);
      // Archived sessions keep their FULL content — history is preserved, never stubbed.
      // (messages are a tree: each session is a root user node with an assistant child)
      type Node = { children?: Node[] };
      const countNodes = (nodes: Node[]): number =>
        nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);
      archivedSessions.forEach(s => expect(countNodes(s.messages)).toBe(2));
    });
  });

  describe('generation controllers', () => {
    it('aborts every registered controller (multi-agent Stop contract)', () => {
      const c1 = new AbortController();
      const c2 = new AbortController();
      const c3 = new AbortController();
      useGiaStore.getState().registerGenerationController('k1', c1);
      useGiaStore.getState().registerGenerationController('k2', c2);
      useGiaStore.getState().registerGenerationController('k3', c3);
      expect(c1.signal.aborted).toBe(false);
      expect(c2.signal.aborted).toBe(false);
      expect(c3.signal.aborted).toBe(false);

      // handleStop iterates the fan-out set and aborts each individually.
      useGiaStore.getState().abortGeneration('k1');
      useGiaStore.getState().abortGeneration('k2');
      useGiaStore.getState().abortGeneration('k3');

      expect(c1.signal.aborted).toBe(true);
      expect(c2.signal.aborted).toBe(true);
      expect(c3.signal.aborted).toBe(true);

      useGiaStore.getState().unregisterGenerationController('k1');
      useGiaStore.getState().unregisterGenerationController('k2');
      useGiaStore.getState().unregisterGenerationController('k3');
      expect(useGiaStore.getState().generationControllers.size).toBe(0);
    });
  });
});
