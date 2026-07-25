import { useNotesStore, randomNoteColor } from '../../store/useNotesStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';
export const noteTools: Tool[] = [
  {
    id: 'note_create', name: 'note_create',
    description: 'Create a new note with title, content, color, and tags.',
    execute: async ({ title, content = '', color = '', tags = [] }) => {
      const store = useNotesStore.getState();
      if (!(title as string) || !(title as string).trim()) {
        return { success: false, content: '', error: 'Note title is required' };
      }
      const id = store.addNote({
        title: (title as string).trim(),
        content: content as string,
        color: (color as string) || randomNoteColor(),
        pinned: false,
        tags: Array.isArray(tags) ? tags : [],
      });
      return { success: true, content: `Created note "${title}" with ID: ${id}` };
    }
  },
  {
    id: 'note_read', name: 'note_read',
    description: 'Read a note by ID, or list/search notes.',
    execute: async ({ id = null, search = null }) => {
      const store = useNotesStore.getState();
      if (id) {
        const note = store.getNote(id as string);
        if (!note) {
          return { success: false, content: '', error: `Note with ID ${id} not found` };
        }
        return {
          success: true,
          content: JSON.stringify({
            id: note.id,
            title: note.title,
            content: note.content,
            color: note.color,
            pinned: note.pinned,
            tags: note.tags,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
          }, null, 2)
        };
      } else {
        let notes = store.notes;
        if (search && typeof search === 'string') {
          notes = store.searchNotes(search);
        }
        return {
          success: true,
          content: JSON.stringify(notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content.substring(0, 200) + (n.content.length > 200 ? '...' : ''),
            color: n.color,
            pinned: n.pinned,
            tags: n.tags
          })), null, 2)
        };
      }
    }
  },
  {
    id: 'note_update', name: 'note_update',
    description: 'Update a note by ID with new properties.',
    execute: async ({ id, title, content, color, tags }) => {
      const store = useNotesStore.getState();
      const note = store.getNote(id as string);
      if (!note) {
        return { success: false, content: '', error: `Note with ID ${id} not found` };
      }
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (color !== undefined) updates.color = color;
      if (tags !== undefined) updates.tags = tags;
      if (Object.keys(updates).length === 0) {
        return { success: false, content: '', error: 'No updates provided' };
      }
      store.updateNote(id as string, updates);
      return { success: true, content: `Updated note ${id}` };
    }
  },
  {
    id: 'note_delete', name: 'note_delete',
    description: 'Delete a note by ID.',
    execute: async ({ id }) => {
      const store = useNotesStore.getState();
      const note = store.getNote(id as string);
      if (!note) {
        return { success: false, content: '', error: `Note with ID ${id as string} not found` };
      }
      store.deleteNote(id as string);
      return { success: true, content: `Deleted note "${note.title}"` };
    }
  },
  {
    id: 'note_toggle_pin', name: 'note_toggle_pin',
    description: 'Toggle the pinned state of a note.',
    execute: async ({ id }) => {
      const store = useNotesStore.getState();
      const note = store.getNote(id as string);
      if (!note) {
        return { success: false, content: '', error: `Note with ID ${id as string} not found` };
      }
      store.togglePin(id as string);
      return { success: true, content: `Toggled pin for note "${note.title}"` };
    }
  }
];


export function registerNoteTools() {
  for (const tool of noteTools) ToolRegistry.register(tool);
}
