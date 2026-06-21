import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const { useNotesStore, randomNoteColor } = await import('../useNotesStore');
type GiaNote = import('../useNotesStore').GiaNote;

function makeNote(overrides: Partial<GiaNote> = {}): GiaNote {
  return {
    id: overrides.id ?? 'note-1',
    title: overrides.title ?? 'Test Note',
    content: overrides.content ?? 'Some content',
    color: overrides.color ?? '#ffffff',
    pinned: overrides.pinned ?? false,
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

describe('useNotesStore', () => {
  beforeEach(() => {
    useNotesStore.setState({ notes: [] });
  });

  describe('randomNoteColor', () => {
    it('returns a hex color from the palette', () => {
      const color = randomNoteColor();
      expect(color).toMatch(/^#[a-f0-9]{6}$/);
    });
  });

  describe('addNote', () => {
    it('adds a note with generated id and timestamps', () => {
      const id = useNotesStore.getState().addNote(makeNote({ id: undefined as unknown as string }));
      const note = useNotesStore.getState().notes[0];
      expect(note.id).toBe(id);
      expect(note.title).toBe('Test Note');
      expect(note.createdAt).toBeGreaterThan(0);
      expect(note.updatedAt).toBeGreaterThan(0);
    });

    it('prepends new notes to the list', () => {
      useNotesStore.getState().addNote(makeNote({ title: 'First', id: undefined as unknown as string }));
      useNotesStore.getState().addNote(makeNote({ title: 'Second', id: undefined as unknown as string }));
      expect(useNotesStore.getState().notes[0].title).toBe('Second');
    });
  });

  describe('updateNote', () => {
    it('updates note fields and bumps updatedAt', () => {
      const id = useNotesStore.getState().addNote(makeNote({ id: undefined as unknown as string }));
      useNotesStore.getState().updateNote(id, { title: 'Updated', content: 'New content' });
      const note = useNotesStore.getState().notes[0];
      expect(note.title).toBe('Updated');
      expect(note.content).toBe('New content');
      expect(note.updatedAt).toBeGreaterThanOrEqual(note.createdAt);
    });
  });

  describe('deleteNote', () => {
    it('removes a note by id', () => {
      const id = useNotesStore.getState().addNote(makeNote({ id: undefined as unknown as string }));
      useNotesStore.getState().deleteNote(id);
      expect(useNotesStore.getState().notes).toHaveLength(0);
    });
  });

  describe('togglePin', () => {
    it('toggles the pinned flag', () => {
      const id = useNotesStore.getState().addNote(makeNote({ id: undefined as unknown as string }));
      useNotesStore.getState().togglePin(id);
      expect(useNotesStore.getState().notes[0].pinned).toBe(true);
      useNotesStore.getState().togglePin(id);
      expect(useNotesStore.getState().notes[0].pinned).toBe(false);
    });
  });

  describe('searchNotes', () => {
    beforeEach(() => {
      useNotesStore.getState().addNote(makeNote({ title: 'Shopping List', content: 'milk eggs bread', tags: ['groceries'], id: undefined as unknown as string }));
      useNotesStore.getState().addNote(makeNote({ title: 'Work Notes', content: 'meeting with team', tags: ['work'], id: undefined as unknown as string }));
      useNotesStore.getState().addNote(makeNote({ title: 'Ideas', content: 'project brainstorming', tags: ['creative', 'work'], id: undefined as unknown as string }));
    });

    it('finds by title', () => {
      const results = useNotesStore.getState().searchNotes('shopping');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Shopping List');
    });

    it('finds by content', () => {
      const results = useNotesStore.getState().searchNotes('meeting');
      expect(results).toHaveLength(1);
    });

    it('finds by tag', () => {
      const results = useNotesStore.getState().searchNotes('creative');
      expect(results).toHaveLength(1);
    });

    it('finds across multiple fields', () => {
      const results = useNotesStore.getState().searchNotes('work');
      expect(results).toHaveLength(2);
    });

    it('is case-insensitive', () => {
      const results = useNotesStore.getState().searchNotes('SHOPPING');
      expect(results).toHaveLength(1);
    });

    it('returns empty for no match', () => {
      const results = useNotesStore.getState().searchNotes('zzzzz');
      expect(results).toHaveLength(0);
    });
  });

  describe('getNote', () => {
    it('returns a note by id', () => {
      const id = useNotesStore.getState().addNote(makeNote({ id: undefined as unknown as string }));
      const note = useNotesStore.getState().getNote(id);
      expect(note).toBeDefined();
      expect(note!.title).toBe('Test Note');
    });

    it('returns undefined for missing id', () => {
      expect(useNotesStore.getState().getNote('missing')).toBeUndefined();
    });
  });
});
