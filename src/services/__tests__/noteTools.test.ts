import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockNotes: Record<string, unknown>[] = [];

vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: () => ({
        notes: mockNotes,
        addNote: vi.fn((note: unknown) => {
          const id = 'note-' + mockNotes.length;
          mockNotes.push({ ...(note as object), id } as Record<string, unknown>);
          return id;
        }),
        updateNote: vi.fn(),
        deleteNote: vi.fn((id: string) => { mockNotes = mockNotes.filter(n => (n as { id: string }).id !== id); }),
        togglePin: vi.fn(),
        searchNotes: vi.fn((q: string) => mockNotes.filter(n => JSON.stringify(n).toLowerCase().includes(q.toLowerCase()))),
        getNote: vi.fn((id: string) => mockNotes.find(n => (n as { id: string }).id === id)),
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

  it('creates a note', async () => {
    const tool = noteTools.find(t => t.id === 'note_create');
    expect(tool).toBeDefined();
    if (!tool) return;
    const result = await tool.execute({ title: 'Test Note', content: 'Hello world' });
    expect(result.success).toBe(true);
    expect(mockNotes).toHaveLength(1);
    expect(mockNotes[0].title).toBe('Test Note');
  });

  it('reads a note', async () => {
    mockNotes.push({ id: 'note-0', title: 'My Note', content: 'Stuff', color: '#fff', pinned: false, tags: [], createdAt: 100, updatedAt: 100 });
    const tool = noteTools.find(t => t.id === 'note_read');
    expect(tool).toBeDefined();
    if (!tool) return;
    const result = await tool.execute({ id: 'note-0' });
    expect(result.success).toBe(true);
  });

  it('searches notes', async () => {
    mockNotes.push({ id: 'n1', title: 'Alpha', content: 'bravo', color: '#fff', pinned: false, tags: [], createdAt: 100, updatedAt: 100 });
    mockNotes.push({ id: 'n2', title: 'Charlie', content: 'delta', color: '#fff', pinned: false, tags: [], createdAt: 200, updatedAt: 200 });
    const tool = noteTools.find(t => t.id === 'note_search');
    expect(tool).toBeDefined();
    if (!tool) return;
    const result = await tool.execute({ query: 'bravo' });
    expect(result.success).toBe(true);
  });

  it('updates a note', async () => {
    mockNotes.push({ id: 'n-u', title: 'Old', content: 'old', color: '#fff', pinned: false, tags: [], createdAt: 100, updatedAt: 100 });
    const tool = noteTools.find(t => t.id === 'note_update');
    expect(tool).toBeDefined();
    if (!tool) return;
    const result = await tool.execute({ id: 'n-u', title: 'Updated' });
    expect(result.success).toBe(true);
    expect(mockNotes[0].title).toBe('Updated');
  });

  it('deletes a note', async () => {
    mockNotes.push({ id: 'n-d', title: 'Delete Me', content: '', color: '#fff', pinned: false, tags: [], createdAt: 100, updatedAt: 100 });
    const tool = noteTools.find(t => t.id === 'note_delete');
    expect(tool).toBeDefined();
    if (!tool) return;
    const result = await tool.execute({ id: 'n-d' });
    expect(result.success).toBe(true);
    expect(mockNotes).toHaveLength(0);
  });
});
