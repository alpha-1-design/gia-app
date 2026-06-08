import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProtocolStore } from '../useProtocolStore';
import type { ProtocolProposal } from '../../types/protocol';

// Mock IndexedDB storage
vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

function makeProposal(overrides: Partial<ProtocolProposal> = {}): ProtocolProposal {
  return {
    id: 'test-proposal-1',
    type: 'web_search',
    summary: 'Search the web',
    description: 'Search for information on a topic',
    args: { query: 'test query' },
    impact: 'network',
    state: 'proposed',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('useProtocolStore', () => {
  beforeEach(() => {
    useProtocolStore.setState({ protocols: [], consoleProtocols: [], pendingConfirm: null });
  });

  describe('propose', () => {
    it('adds a protocol to both lists', () => {
      useProtocolStore.getState().propose(makeProposal());
      const state = useProtocolStore.getState();
      expect(state.protocols).toHaveLength(1);
      expect(state.consoleProtocols).toHaveLength(1);
    });

    it('appends to existing protocols', () => {
      useProtocolStore.getState().propose(makeProposal({ id: 'p1' }));
      useProtocolStore.getState().propose(makeProposal({ id: 'p2' }));
      expect(useProtocolStore.getState().protocols).toHaveLength(2);
    });
  });

  describe('confirm', () => {
    it('marks protocol as confirmed', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().confirm('test-proposal-1');
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('confirmed');
      expect(p.confirmedAt).toBeDefined();
    });

    it('does nothing for unknown id', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().confirm('non-existent');
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('proposed');
    });
  });

  describe('reject', () => {
    it('marks protocol as rejected', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().reject('test-proposal-1');
      expect(useProtocolStore.getState().protocols[0].state).toBe('rejected');
    });
  });

  describe('modify', () => {
    it('marks protocol as modified with new args', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().modify('test-proposal-1', { query: 'modified query' });
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('modified');
      expect(p.args).toEqual({ query: 'modified query' });
    });
  });

  describe('setExecuting', () => {
    it('marks protocol as executing', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().setExecuting('test-proposal-1');
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('executing');
      expect(p.executedAt).toBeDefined();
    });
  });

  describe('setCompleted', () => {
    it('marks protocol as completed with result', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().setCompleted('test-proposal-1', 'search results', [{ title: 'Result 1', url: 'https://example.com' }]);
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('completed');
      expect(p.result).toBe('search results');
      expect(p.sources).toHaveLength(1);
      expect(p.completedAt).toBeDefined();
    });
  });

  describe('setFailed', () => {
    it('marks protocol as failed with error', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().setFailed('test-proposal-1', 'Something went wrong');
      const p = useProtocolStore.getState().protocols[0];
      expect(p.state).toBe('failed');
      expect(p.error).toBe('Something went wrong');
      expect(p.completedAt).toBeDefined();
    });
  });

  describe('clearProtocols', () => {
    it('clears all protocols', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().clearProtocols();
      expect(useProtocolStore.getState().protocols).toHaveLength(0);
      // consoleProtocols should still have them
      expect(useProtocolStore.getState().consoleProtocols).toHaveLength(1);
    });
  });

  describe('clearConsoleProtocols', () => {
    it('clears console protocols only', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().clearConsoleProtocols();
      expect(useProtocolStore.getState().consoleProtocols).toHaveLength(0);
      expect(useProtocolStore.getState().protocols).toHaveLength(1);
    });
  });

  describe('waitForConfirmation and resolvePending', () => {
    it('resolves with confirm action', async () => {
      useProtocolStore.getState().propose(makeProposal());

      const promise = useProtocolStore.getState().waitForConfirmation('test-proposal-1');
      useProtocolStore.getState().confirm('test-proposal-1');

      const action = await promise;
      expect(action.type).toBe('confirm');
      expect(action.protocolId).toBe('test-proposal-1');
    });

    it('resolves with reject action', async () => {
      useProtocolStore.getState().propose(makeProposal());

      const promise = useProtocolStore.getState().waitForConfirmation('test-proposal-1');
      useProtocolStore.getState().reject('test-proposal-1');

      const action = await promise;
      expect(action.type).toBe('reject');
    });

    it('resolves with modify action', async () => {
      useProtocolStore.getState().propose(makeProposal());

      const promise = useProtocolStore.getState().waitForConfirmation('test-proposal-1');
      useProtocolStore.getState().modify('test-proposal-1', { query: 'modified' });

      const action = await promise;
      expect(action.type).toBe('modify');
      expect(action.modifiedArgs).toEqual({ query: 'modified' });
    });

    it('rejects after timeout', async () => {
      vi.useFakeTimers();
      useProtocolStore.getState().propose(makeProposal());

      const promise = useProtocolStore.getState().waitForConfirmation('test-proposal-1', 100);
      vi.advanceTimersByTime(100);

      const action = await promise;
      expect(action.type).toBe('reject');
      expect(action.protocolId).toBe('test-proposal-1');
      vi.useRealTimers();
    });

    it('second waiter replaces first', async () => {
      useProtocolStore.getState().propose(makeProposal({ id: 'p1' }));
      useProtocolStore.getState().propose(makeProposal({ id: 'p2' }));

      useProtocolStore.getState().waitForConfirmation('p1');
      const promise2 = useProtocolStore.getState().waitForConfirmation('p2');

      useProtocolStore.getState().confirm('p2');

      const action = await promise2;
      expect(action.protocolId).toBe('p2');
    });
  });

  describe('state transitions', () => {
    it('follows propose → confirm → executing → completed', () => {
      useProtocolStore.getState().propose(makeProposal());
      expect(useProtocolStore.getState().protocols[0].state).toBe('proposed');

      useProtocolStore.getState().confirm('test-proposal-1');
      expect(useProtocolStore.getState().protocols[0].state).toBe('confirmed');

      useProtocolStore.getState().setExecuting('test-proposal-1');
      expect(useProtocolStore.getState().protocols[0].state).toBe('executing');

      useProtocolStore.getState().setCompleted('test-proposal-1', 'done');
      expect(useProtocolStore.getState().protocols[0].state).toBe('completed');
    });

    it('follows propose → reject', () => {
      useProtocolStore.getState().propose(makeProposal());
      useProtocolStore.getState().reject('test-proposal-1');
      expect(useProtocolStore.getState().protocols[0].state).toBe('rejected');
    });
  });
});
