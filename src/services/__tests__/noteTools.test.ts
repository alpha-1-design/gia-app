import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockNotes: Map<string, unknown>[] = [];

vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: () => ({
        notes: mockNotes,
        addNote: vi.fn((note: unknown) => {
          const id = 'note-' + mockNotes.length;
          mockNotes.push({ ...(note as object), id } as Map<string, unknown>);
          return id;
        }),
        updateNote: vi.fn(),
        deleteNote: vi.fn((id: string) => { mockNotes = mockNotes.filter(n => (n as unknown as { id: string }).id !== id); }),
        togglePin: vi.fn(),
        searchNotes: vi.fn((q: string) => mockNotes.filter(n => JSON.stringify(n).toLowerCase().includes(q.toLowerCase()))),
        getNote: vi.fn((id: string) => mockNotes.find(n => (n as unknown as { id: string }).id === id)),
      }),
    }
  ),
  randomNoteColor: vi.fn(() => '#fef3c7'),
}));

const { noteTools } = await import('../tools/notes');

describe('note tools', () => {
  beforeEach(() => {
    mockNotes = [];
  });

  function makeNote(id: string, title: string, content = '', overrides: Record<string, unknown> = {}) {
    return { id, title, content, color: '#fff', pinned: false, tags: [] as string[], createdAt: 1, updatedAt: 1, ...overrides } as unknown as Map<string, unknown>;
  }

  describe('note_create', () => {
    const createTool = noteTools.find(t => t.id === 'note_create')!;

    it('creates a note with title and content', async () => {
      const result = await createTool.execute({ title: 'Test', content: 'Hello', color: '#fff', tags: ['tag1'] });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Test');
    });

    it('fails on empty title', async () => {
      const result = await createTool.execute({ title: '', content: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('title is required');
    });
  });

  describe('note_read', () => {
    const readTool = noteTools.find(t => t.id === 'note_read')!;

    it('reads a note by ID', async () => {
      mockNotes.push(makeNote('n1', 'My Note', 'content'));
      const result = await readTool.execute({ id: 'n1' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('My Note');
    });

    it('returns error for missing note', async () => {
      const result = await readTool.execute({ id: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('lists all notes when no id', async () => {
      mockNotes.push(makeNote('n1', 'A', 'a'));
      mockNotes.push(makeNote('n2', 'B', 'b'));
      const result = await readTool.execute({});
      expect(result.success).toBe(true);
      expect(result.content).toContain('A');
      expect(result.content).toContain('B');
    });

    it('searches notes with search param', async () => {
      mockNotes.push(makeNote('n1', 'Shopping', 'milk'));
      mockNotes.push(makeNote('n2', 'Work', 'meeting'));
      const result = await readTool.execute({ search: 'meeting' });
      expect(result.content).toContain('Work');
      expect(result.content).not.toContain('Shopping');
    });
  });

  describe('note_update', () => {
    const updateTool = noteTools.find(t => t.id === 'note_update')!;

    it('updates an existing note', async () => {
      mockNotes.push(makeNote('n1', 'Old'));
      const result = await updateTool.execute({ id: 'n1', title: 'New' });
      expect(result.success).toBe(true);
    });

    it('fails on missing note', async () => {
      const result = await updateTool.execute({ id: 'missing', title: 'Nope' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('fails with no updates', async () => {
      mockNotes.push(makeNote('n1', 'Old'));
      const result = await updateTool.execute({ id: 'n1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No updates');
    });
  });

  describe('note_delete', () => {
    const deleteTool = noteTools.find(t => t.id === 'note_delete')!;

    it('deletes an existing note', async () => {
      mockNotes.push(makeNote('n1', 'To Delete'));
      const result = await deleteTool.execute({ id: 'n1' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('To Delete');
    });

    it('fails on missing note', async () => {
      const result = await deleteTool.execute({ id: 'missing' });
      expect(result.success).toBe(false);
    });
  });

  describe('note_toggle_pin', () => {
    const pinTool = noteTools.find(t => t.id === 'note_toggle_pin')!;

    it('toggles pin on existing note', async () => {
      mockNotes.push(makeNote('n1', 'Note'));
      const result = await pinTool.execute({ id: 'n1' });
      expect(result.success).toBe(true);
    });

    it('fails on missing note', async () => {
      const result = await pinTool.execute({ id: 'missing' });
      expect(result.success).toBe(false);
    });
  });
});
