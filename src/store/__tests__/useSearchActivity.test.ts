import { describe, it, expect, beforeEach } from 'vitest';

import { useSearchActivity } from '../useSearchActivity';

describe('useSearchActivity', () => {
  beforeEach(() => {
    useSearchActivity.setState({
      active: false,
      events: [],
      sources: [],
      panelOpen: false,
      queryCount: 0,
      fetchCount: 0,
    });
  });

  describe('startSearch / endSearch', () => {
    it('sets active to true and resets counts', () => {
      useSearchActivity.getState().startSearch();
      expect(useSearchActivity.getState().active).toBe(true);
      expect(useSearchActivity.getState().queryCount).toBe(0);
      expect(useSearchActivity.getState().fetchCount).toBe(0);
    });

    it('sets active to false', () => {
      useSearchActivity.getState().startSearch();
      useSearchActivity.getState().endSearch();
      expect(useSearchActivity.getState().active).toBe(false);
    });
  });

  describe('addEvent', () => {
    it('adds event with generated id and timestamp', () => {
      useSearchActivity.getState().addEvent({ type: 'query', message: 'Searching...', done: false });
      const events = useSearchActivity.getState().events;
      expect(events).toHaveLength(1);
      expect(events[0].id).toMatch(/^sev_/);
      expect(events[0].timestamp).toBeGreaterThan(0);
      expect(events[0].message).toBe('Searching...');
    });

    it('increments queryCount for query events', () => {
      useSearchActivity.getState().addEvent({ type: 'query', message: 'q1', done: false });
      useSearchActivity.getState().addEvent({ type: 'query', message: 'q2', done: false });
      expect(useSearchActivity.getState().queryCount).toBe(2);
    });

    it('increments fetchCount for fetch events', () => {
      useSearchActivity.getState().addEvent({ type: 'fetch', message: 'Fetching...', url: 'https://example.com', done: false });
      expect(useSearchActivity.getState().fetchCount).toBe(1);
    });

    it('does not increment counts for result/error/info events', () => {
      useSearchActivity.getState().addEvent({ type: 'result', message: 'Found', done: false });
      useSearchActivity.getState().addEvent({ type: 'error', message: 'Failed', done: false });
      useSearchActivity.getState().addEvent({ type: 'info', message: 'Info', done: false });
      expect(useSearchActivity.getState().queryCount).toBe(0);
      expect(useSearchActivity.getState().fetchCount).toBe(0);
    });
  });

  describe('completeEvent', () => {
    it('marks matching event as done', () => {
      useSearchActivity.getState().addEvent({ type: 'query', message: 'Searching...', done: false });
      useSearchActivity.getState().completeEvent('Searching...');
      expect(useSearchActivity.getState().events[0].done).toBe(true);
    });

    it('does not affect other events', () => {
      useSearchActivity.getState().addEvent({ type: 'query', message: 'q1', done: false });
      useSearchActivity.getState().addEvent({ type: 'query', message: 'q2', done: false });
      useSearchActivity.getState().completeEvent('q1');
      expect(useSearchActivity.getState().events[0].done).toBe(true);
      expect(useSearchActivity.getState().events[1].done).toBe(false);
    });
  });

  describe('addSource', () => {
    it('adds source', () => {
      useSearchActivity.getState().addSource({ title: 'Example', url: 'https://example.com', snippet: 'A page', source: 'exa' });
      expect(useSearchActivity.getState().sources).toHaveLength(1);
    });

    it('deduplicates by url', () => {
      useSearchActivity.getState().addSource({ title: 'V1', url: 'https://example.com', snippet: 's1', source: 'exa' });
      useSearchActivity.getState().addSource({ title: 'V2', url: 'https://example.com', snippet: 's2', source: 'exa' });
      expect(useSearchActivity.getState().sources).toHaveLength(1);
      expect(useSearchActivity.getState().sources[0].title).toBe('V1');
    });

    it('allows different urls', () => {
      useSearchActivity.getState().addSource({ title: 'A', url: 'https://a.com', snippet: '', source: 'exa' });
      useSearchActivity.getState().addSource({ title: 'B', url: 'https://b.com', snippet: '', source: 'exa' });
      expect(useSearchActivity.getState().sources).toHaveLength(2);
    });
  });

  describe('setPanelOpen', () => {
    it('opens and closes panel', () => {
      useSearchActivity.getState().setPanelOpen(true);
      expect(useSearchActivity.getState().panelOpen).toBe(true);
      useSearchActivity.getState().setPanelOpen(false);
      expect(useSearchActivity.getState().panelOpen).toBe(false);
    });
  });

  describe('clear', () => {
    it('resets everything', () => {
      useSearchActivity.getState().startSearch();
      useSearchActivity.getState().addEvent({ type: 'query', message: 'q1', done: false });
      useSearchActivity.getState().addSource({ title: 'A', url: 'https://a.com', snippet: '', source: 'exa' });
      useSearchActivity.getState().setPanelOpen(true);

      useSearchActivity.getState().clear();
      const state = useSearchActivity.getState();
      expect(state.active).toBe(false);
      expect(state.events).toEqual([]);
      expect(state.sources).toEqual([]);
      expect(state.queryCount).toBe(0);
      expect(state.fetchCount).toBe(0);
      // panelOpen is NOT reset by clear (it's independent)
    });
  });
});
