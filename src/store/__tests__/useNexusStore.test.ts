import { describe, it, expect, beforeEach } from 'vitest';

import { useNexusStore } from '../useNexusStore';

describe('useNexusStore', () => {
  beforeEach(() => {
    useNexusStore.setState({ activeRun: null });
  });

  it('starts with no active run', () => {
    expect(useNexusStore.getState().activeRun).toBeNull();
  });

  describe('startRun', () => {
    it('creates a run with agents', () => {
      useNexusStore.getState().startRun('run-1', 'session-1', false, [
        { id: 'a1', name: 'Researcher', color: '#f00', icon: '🔍', role: 'research', task: 'Find info', startedAt: Date.now() },
        { id: 'a2', name: 'Writer', color: '#0f0', icon: '✍️', role: 'write', task: 'Write report', startedAt: Date.now() },
      ]);
      const run = useNexusStore.getState().activeRun;
      expect(run).not.toBeNull();
      expect(run!.id).toBe('run-1');
      expect(run!.sessionId).toBe('session-1');
      expect(run!.agents).toHaveLength(2);
      expect(run!.agents[0].status).toBe('spawning');
      expect(run!.synthesizing).toBe(false);
    });

    it('records startedAt timestamp', () => {
      const before = Date.now();
      useNexusStore.getState().startRun('run-1', 's1', false, []);
      expect(useNexusStore.getState().activeRun!.startedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('updateAgent', () => {
    it('updates agent status', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, [
        { id: 'a1', name: 'Agent', color: '#f00', icon: '🤖', role: 'task', task: 'do stuff', startedAt: Date.now() },
      ]);
      useNexusStore.getState().updateAgent('run-1', 'a1', { status: 'running' });
      expect(useNexusStore.getState().activeRun!.agents[0].status).toBe('running');
    });

    it('updates agent result', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, [
        { id: 'a1', name: 'Agent', color: '#f00', icon: '🤖', role: 'task', task: 'do stuff', startedAt: Date.now() },
      ]);
      useNexusStore.getState().updateAgent('run-1', 'a1', { status: 'completed', result: 'Done!' });
      expect(useNexusStore.getState().activeRun!.agents[0].result).toBe('Done!');
      expect(useNexusStore.getState().activeRun!.agents[0].status).toBe('completed');
    });

    it('updates current activity', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, [
        { id: 'a1', name: 'Agent', color: '#f00', icon: '🤖', role: 'task', task: 'do stuff', startedAt: Date.now() },
      ]);
      useNexusStore.getState().updateAgent('run-1', 'a1', { currentActivity: 'Running tests...' });
      expect(useNexusStore.getState().activeRun!.agents[0].currentActivity).toBe('Running tests...');
    });
  });

  describe('setSynthesizing', () => {
    it('toggles synthesizing state', () => {
      useNexusStore.getState().startRun('run-1', 's1', true, []);
      useNexusStore.getState().setSynthesizing('run-1', true);
      expect(useNexusStore.getState().activeRun!.synthesizing).toBe(true);
      useNexusStore.getState().setSynthesizing('run-1', false);
      expect(useNexusStore.getState().activeRun!.synthesizing).toBe(false);
    });
  });

  describe('finishRun', () => {
    it('sets finishedAt timestamp', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, []);
      useNexusStore.getState().finishRun('run-1');
      expect(useNexusStore.getState().activeRun!.finishedAt).toBeDefined();
      expect(useNexusStore.getState().activeRun!.finishedAt).toBeGreaterThan(0);
    });
  });

  describe('clearRun', () => {
    it('removes active run', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, []);
      useNexusStore.getState().clearRun();
      expect(useNexusStore.getState().activeRun).toBeNull();
    });
  });

  describe('session isolation', () => {
    it('startRun replaces previous run', () => {
      useNexusStore.getState().startRun('run-1', 's1', false, []);
      useNexusStore.getState().startRun('run-2', 's2', true, []);
      expect(useNexusStore.getState().activeRun!.id).toBe('run-2');
    });
  });
});
