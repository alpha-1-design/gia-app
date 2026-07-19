import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const { useGiaStore } = await import('../useGiaStore');
type ChatSession = import('../useGiaStore').ChatSession;

function makeSession(id: string, title: string, msgCount: number): ChatSession {
  const messages = Array.from({ length: msgCount }, (_, i) => ({
    message: { id: `${id}-m${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `Full content for ${title} message ${i}` },
    children: [],
  }));
  return {
    id,
    title,
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentBranchId: 'b1',
    branches: { b1: { id: 'b1', name: 'Main', createdAt: Date.now() } },
  } as unknown as ChatSession;
}

describe('hibernateSessions / restoreSession', () => {
  beforeEach(() => {
    // 1 active + 7 inactive (with messages) => 2 should be archived, 5 kept.
    const active = makeSession('active', 'Active Chat', 3);
    const inactive = Array.from({ length: 7 }, (_, i) => makeSession(`s${i}`, `Chat ${i}`, 2));
    useGiaStore.setState({
      sessions: [active, ...inactive],
      activeSessionId: 'active',
      archivedSessions: [],
    });
  });

  it('archives old sessions WITHOUT destroying their message content', () => {
    useGiaStore.getState().hibernateSessions();
    const { sessions, archivedSessions } = useGiaStore.getState();

    expect(archivedSessions).toHaveLength(2);
    expect(sessions).toHaveLength(6); // 1 active + 5 remaining inactive
    expect(useGiaStore.getState().activeSessionId).toBe('active');

    // The archived sessions keep their FULL message history.
    const archived = archivedSessions[0];
    expect(archived.messages).toHaveLength(2);
    expect(archived.messages[0].message.content).toBe('Full content for Chat 0 message 0');
    // No truncation stub.
    expect(archived.messages[0].message.content.startsWith('Archived —')).toBe(false);
  });

  it('does not archive when there are 5 or fewer inactive sessions', () => {
    const active = makeSession('active', 'Active Chat', 3);
    const inactive = Array.from({ length: 4 }, (_, i) => makeSession(`s${i}`, `Chat ${i}`, 2));
    useGiaStore.setState({ sessions: [active, ...inactive], activeSessionId: 'active', archivedSessions: [] });

    useGiaStore.getState().hibernateSessions();
    expect(useGiaStore.getState().archivedSessions).toHaveLength(0);
    expect(useGiaStore.getState().sessions).toHaveLength(5);
  });

  it('restoreSession moves an archived session back with full content and activates it', () => {
    useGiaStore.getState().hibernateSessions();
    const archivedId = useGiaStore.getState().archivedSessions[0].id;
    const archivedContent = useGiaStore.getState().archivedSessions[0].messages[0].message.content;

    useGiaStore.getState().restoreSession(archivedId);

    const { sessions, archivedSessions, activeSessionId } = useGiaStore.getState();
    expect(archivedSessions.find((s) => s.id === archivedId)).toBeUndefined();
    const restored = sessions.find((s) => s.id === archivedId);
    expect(restored).toBeDefined();
    expect(restored!.messages[0].message.content).toBe(archivedContent);
    expect(activeSessionId).toBe(archivedId);
  });

  it('restoreSession is a no-op for an unknown id', () => {
    useGiaStore.getState().hibernateSessions();
    const before = useGiaStore.getState().archivedSessions.length;
    useGiaStore.getState().restoreSession('does-not-exist');
    expect(useGiaStore.getState().archivedSessions).toHaveLength(before);
  });
});
