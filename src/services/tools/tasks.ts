import { useTaskStore } from '../../store/useTaskStore';
import type { Tool } from './types';
export const taskTools: Tool[] = [
  {
    id: 'task_create', name: 'task_create',
    description: 'Create a new task with title, description, priority, tags, and due date.',
    execute: async ({ title, description = '', priority = 'medium', tags = [], dueDate = null }) => {
      const store = useTaskStore.getState();
      if (!title || !title.trim()) {
        return { success: false, content: '', error: 'Task title is required' };
      }
      const id = store.addTask({
        title: title.trim(),
        description,
        status: 'todo',
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        tags: Array.isArray(tags) ? tags : [],
        dueDate: dueDate || null,
      });
      return { success: true, content: `Created task "${title}" with ID: ${id}` };
    }
  },
  {
    id: 'task_read', name: 'task_read',
    description: 'Read a task by ID, or list tasks by status (todo, in_progress, done).',
    execute: async ({ id = null, status = null }) => {
      const store = useTaskStore.getState();
      if (id) {
        const task = store.tasks.find(t => t.id === id);
        if (!task) {
          return { success: false, content: '', error: `Task with ID ${id} not found` };
        }
        return {
          success: true,
          content: JSON.stringify({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            tags: task.tags,
            dueDate: task.dueDate,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          }, null, 2)
        };
      } else {
        const tasks = status
          ? store.getTasksByStatus(status as 'todo' | 'in_progress' | 'done')
          : store.tasks;
        return {
          success: true,
          content: JSON.stringify(tasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            tags: t.tags
          })), null, 2)
        };
      }
    }
  },
  {
    id: 'task_update', name: 'task_update',
    description: 'Update a task by ID with new properties.',
    execute: async ({ id, title, description, status, priority, tags, dueDate }) => {
      const store = useTaskStore.getState();
      const task = store.tasks.find(t => t.id === id);
      if (!task) {
        return { success: false, content: '', error: `Task with ID ${id} not found` };
      }
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (tags !== undefined) updates.tags = tags;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (Object.keys(updates).length === 0) {
        return { success: false, content: '', error: 'No updates provided' };
      }
      store.updateTask(id, updates);
      return { success: true, content: `Updated task ${id}` };
    }
  },
  {
    id: 'task_delete', name: 'task_delete',
    description: 'Delete a task by ID.',
    execute: async ({ id }) => {
      const store = useTaskStore.getState();
      const task = store.tasks.find(t => t.id === id);
      if (!task) {
        return { success: false, content: '', error: `Task with ID ${id} not found` };
      }
      store.deleteTask(id);
      return { success: true, content: `Deleted task "${task.title}"` };
    }
  },
  {
    id: 'task_move', name: 'task_move',
    description: 'Move a task to a different status (todo, in_progress, done).',
    execute: async ({ id, status }) => {
      const store = useTaskStore.getState();
      const task = store.tasks.find(t => t.id === id);
      if (!task) {
        return { success: false, content: '', error: `Task with ID ${id} not found` };
      }
      if (!['todo', 'in_progress', 'done'].includes(status)) {
        return { success: false, content: '', error: `Invalid status: ${status}` };
      }
      store.moveTask(id, status as 'todo' | 'in_progress' | 'done');
      return { success: true, content: `Moved task "${task.title}" to ${status}` };
    }
  }
];
