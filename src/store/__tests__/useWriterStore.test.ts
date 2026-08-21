import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { useWriterStore } from '../useWriterStore';

describe('useWriterStore', () => {
  beforeEach(() => {
    useWriterStore.setState({ prompt: '', draft: '', format: 'Email', wordTarget: 400 });
  });

  it('has defaults', () => {
    expect(useWriterStore.getState().prompt).toBe('');
    expect(useWriterStore.getState().draft).toBe('');
    expect(useWriterStore.getState().format).toBe('Email');
    expect(useWriterStore.getState().wordTarget).toBe(400);
  });

  it('setPrompt updates prompt', () => {
    useWriterStore.getState().setPrompt('Write a blog post about AI');
    expect(useWriterStore.getState().prompt).toBe('Write a blog post about AI');
  });

  it('setDraft updates draft', () => {
    useWriterStore.getState().setDraft('Draft content here');
    expect(useWriterStore.getState().draft).toBe('Draft content here');
  });

  it('setFormat updates format', () => {
    useWriterStore.getState().setFormat('Blog Post');
    expect(useWriterStore.getState().format).toBe('Blog Post');
  });

  it('setWordTarget updates target', () => {
    useWriterStore.getState().setWordTarget(800);
    expect(useWriterStore.getState().wordTarget).toBe(800);
  });

  it('clearDraft resets prompt and draft but keeps format/wordTarget', () => {
    useWriterStore.getState().setPrompt('My prompt');
    useWriterStore.getState().setDraft('My draft');
    useWriterStore.getState().setFormat('Report');
    useWriterStore.getState().setWordTarget(1000);
    useWriterStore.getState().clearDraft();
    expect(useWriterStore.getState().prompt).toBe('');
    expect(useWriterStore.getState().draft).toBe('');
    expect(useWriterStore.getState().format).toBe('Report');
    expect(useWriterStore.getState().wordTarget).toBe(1000);
  });
});
