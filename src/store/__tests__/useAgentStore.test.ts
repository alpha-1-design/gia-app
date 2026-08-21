import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../../services/RAGService', () => ({
  default: {
    indexDocument: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/PDFService', () => ({
  default: {
    extractText: vi.fn().mockResolvedValue('extracted text'),
  },
}));

vi.mock('../../utils/id', () => ({
  genId: vi.fn(() => 'gen-id-' + Math.random().toString(36).slice(2, 8)),
}));

import { useAgentStore, type AgentMessage } from '../useAgentStore';

function makeAgent(overrides = {}) {
  return {
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a test agent',
    icon: '🤖',
    tools: [],
    ...overrides,
  };
}

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: 'msg-' + Date.now(),
    role: 'assistant',
    content: 'Hello!',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('useAgentStore', () => {
  beforeEach(() => {
    useAgentStore.setState({ agents: [], chatSessions: {} });
  });

  // =========================================================================
  // addAgent
  // =========================================================================
  describe('addAgent', () => {
    it('creates agent with generated id and timestamp', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      expect(agent.id).toBeDefined();
      expect(agent.createdAt).toBeGreaterThan(0);
      expect(agent.name).toBe('Test Agent');
      expect(agent.files).toEqual([]);
    });

    it('adds agent to the agents list', () => {
      useAgentStore.getState().addAgent(makeAgent());
      expect(useAgentStore.getState().agents).toHaveLength(1);
    });

    it('preserves tools from input', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent({ tools: ['web_search', 'terminal'] }));
      expect(agent.tools).toEqual(['web_search', 'terminal']);
    });

    it('defaults tools to empty array when not provided', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      expect(agent.tools).toEqual([]);
    });

    it('can add multiple agents', () => {
      useAgentStore.getState().addAgent(makeAgent({ name: 'Agent 1' }));
      useAgentStore.getState().addAgent(makeAgent({ name: 'Agent 2' }));
      expect(useAgentStore.getState().agents).toHaveLength(2);
    });
  });

  // =========================================================================
  // updateAgent
  // =========================================================================
  describe('updateAgent', () => {
    it('updates agent fields', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().updateAgent(agent.id, { name: 'Updated Agent' });
      expect(useAgentStore.getState().getAgent(agent.id)?.name).toBe('Updated Agent');
    });

    it('does not affect other agents', () => {
      const a1 = useAgentStore.getState().addAgent(makeAgent({ name: 'A1' }));
      const a2 = useAgentStore.getState().addAgent(makeAgent({ name: 'A2' }));
      useAgentStore.getState().updateAgent(a1.id, { name: 'Updated A1' });
      expect(useAgentStore.getState().getAgent(a2.id)?.name).toBe('A2');
    });
  });

  // =========================================================================
  // updateAgentTools
  // =========================================================================
  describe('updateAgentTools', () => {
    it('updates agent tools', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().updateAgentTools(agent.id, ['web_search']);
      expect(useAgentStore.getState().getAgent(agent.id)?.tools).toEqual(['web_search']);
    });
  });

  // =========================================================================
  // removeAgent
  // =========================================================================
  describe('removeAgent', () => {
    it('removes agent from list', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().removeAgent(agent.id);
      expect(useAgentStore.getState().agents).toHaveLength(0);
    });

    it('removes associated chat session', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(agent.id, makeMessage());
      expect(useAgentStore.getState().chatSessions[agent.id]).toHaveLength(1);
      useAgentStore.getState().removeAgent(agent.id);
      expect(useAgentStore.getState().chatSessions[agent.id]).toBeUndefined();
    });

    it('does not remove other agents chat sessions', () => {
      const a1 = useAgentStore.getState().addAgent(makeAgent());
      const a2 = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(a1.id, makeMessage());
      useAgentStore.getState().addMessage(a2.id, makeMessage());
      useAgentStore.getState().removeAgent(a1.id);
      expect(useAgentStore.getState().chatSessions[a2.id]).toHaveLength(1);
    });
  });

  // =========================================================================
  // getAgent
  // =========================================================================
  describe('getAgent', () => {
    it('returns agent by id', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      expect(useAgentStore.getState().getAgent(agent.id)).toBeDefined();
    });

    it('returns undefined for non-existent id', () => {
      expect(useAgentStore.getState().getAgent('non-existent')).toBeUndefined();
    });
  });

  // =========================================================================
  // addMessage (THE CRASH FIX — empty array selector)
  // =========================================================================
  describe('addMessage', () => {
    it('adds message to new agent session', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(agent.id, makeMessage({ content: 'Hello' }));
      expect(useAgentStore.getState().chatSessions[agent.id]).toHaveLength(1);
      expect(useAgentStore.getState().chatSessions[agent.id][0].content).toBe('Hello');
    });

    it('appends messages to existing session', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(agent.id, makeMessage({ content: 'Msg 1' }));
      useAgentStore.getState().addMessage(agent.id, makeMessage({ content: 'Msg 2' }));
      useAgentStore.getState().addMessage(agent.id, makeMessage({ content: 'Msg 3' }));
      expect(useAgentStore.getState().chatSessions[agent.id]).toHaveLength(3);
    });

    it('does not mix sessions between agents', () => {
      const a1 = useAgentStore.getState().addAgent(makeAgent());
      const a2 = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(a1.id, makeMessage({ content: 'For A1' }));
      useAgentStore.getState().addMessage(a2.id, makeMessage({ content: 'For A2' }));
      expect(useAgentStore.getState().chatSessions[a1.id]).toHaveLength(1);
      expect(useAgentStore.getState().chatSessions[a2.id]).toHaveLength(1);
      expect(useAgentStore.getState().chatSessions[a1.id][0].content).toBe('For A1');
      expect(useAgentStore.getState().chatSessions[a2.id][0].content).toBe('For A2');
    });

    it('handles adding message for agent that was just created (no prior session)', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      // This was the crash: chatSessions[agent.id] is undefined, || [] creates new ref
      useAgentStore.getState().addMessage(agent.id, makeMessage());
      expect(useAgentStore.getState().chatSessions[agent.id]).toHaveLength(1);
    });

    it('survives rapid sequential adds', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      for (let i = 0; i < 100; i++) {
        useAgentStore.getState().addMessage(agent.id, makeMessage({ content: `msg ${i}` }));
      }
      expect(useAgentStore.getState().chatSessions[agent.id]).toHaveLength(100);
    });
  });

  // =========================================================================
  // clearChat
  // =========================================================================
  describe('clearChat', () => {
    it('empties the chat session but keeps the key', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(agent.id, makeMessage());
      useAgentStore.getState().clearChat(agent.id);
      expect(useAgentStore.getState().chatSessions[agent.id]).toEqual([]);
    });

    it('does not affect other agents chat', () => {
      const a1 = useAgentStore.getState().addAgent(makeAgent());
      const a2 = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(a1.id, makeMessage());
      useAgentStore.getState().addMessage(a2.id, makeMessage());
      useAgentStore.getState().clearChat(a1.id);
      expect(useAgentStore.getState().chatSessions[a1.id]).toEqual([]);
      expect(useAgentStore.getState().chatSessions[a2.id]).toHaveLength(1);
    });
  });

  // =========================================================================
  // Chat session reference stability (THE CRASH ROOT CAUSE)
  // =========================================================================
  describe('chat session reference stability', () => {
    it('empty session returns same reference on repeated reads', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      // Before the fix, this would create a new [] each time via || []
      const s1 = useAgentStore.getState().chatSessions[agent.id];
      const s2 = useAgentStore.getState().chatSessions[agent.id];
      // Both are undefined (no session exists yet) — the selector using ?? EMPTY_MSGS
      // ensures stable references in the component layer
      expect(s1).toBeUndefined();
      expect(s2).toBeUndefined();
    });

    it('session reference is stable after adding message', () => {
      const agent = useAgentStore.getState().addAgent(makeAgent());
      useAgentStore.getState().addMessage(agent.id, makeMessage());
      const session1 = useAgentStore.getState().chatSessions[agent.id];
      const session2 = useAgentStore.getState().chatSessions[agent.id];
      expect(session1).toBe(session2); // Same reference
    });
  });
});
