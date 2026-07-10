import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftStore } from '../useDraftStore';

describe('useDraftStore', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: {} });
  });

  it('returns empty string for a session with no draft', () => {
    expect(useDraftStore.getState().getDraft('session-1')).toBe('');
  });

  it('returns empty string when sessionId is null/undefined', () => {
    expect(useDraftStore.getState().getDraft(null)).toBe('');
    expect(useDraftStore.getState().getDraft(undefined)).toBe('');
  });

  it('stores and retrieves a draft per session', () => {
    useDraftStore.getState().setDraft('session-1', 'hello there');
    expect(useDraftStore.getState().getDraft('session-1')).toBe('hello there');
    expect(useDraftStore.getState().getDraft('session-2')).toBe('');
  });

  it('keeps drafts for different sessions independent', () => {
    useDraftStore.getState().setDraft('session-1', 'draft one');
    useDraftStore.getState().setDraft('session-2', 'draft two');
    expect(useDraftStore.getState().getDraft('session-1')).toBe('draft one');
    expect(useDraftStore.getState().getDraft('session-2')).toBe('draft two');
  });

  it('clears the draft entry when set to an empty string', () => {
    useDraftStore.getState().setDraft('session-1', 'something');
    expect(useDraftStore.getState().drafts['session-1']).toBe('something');
    useDraftStore.getState().setDraft('session-1', '');
    expect('session-1' in useDraftStore.getState().drafts).toBe(false);
  });

  it('clearDraft removes an entry directly', () => {
    useDraftStore.getState().setDraft('session-1', 'something');
    useDraftStore.getState().clearDraft('session-1');
    expect(useDraftStore.getState().getDraft('session-1')).toBe('');
  });

  it('is a no-op when setting a draft with no sessionId', () => {
    useDraftStore.getState().setDraft(null, 'orphan text');
    expect(useDraftStore.getState().drafts).toEqual({});
  });
});
