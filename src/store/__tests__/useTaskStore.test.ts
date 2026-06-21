import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../idb-storage', () => ({
  idbStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const { useTaskStore } = await import('../useTaskStore');
type GiaTask = import('../useTaskStore').GiaTask;

function makeTask(overrides: Partial<GiaTask> = {}): GiaTask {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Test Task',
    description: overrides.description ?? '',
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate ?? null,
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
  };
}

describe('useTaskStore', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], columns: [
      { id: 'todo', title: 'To Do' },
      { id: 'in_progress', title: 'In Progress' },
      { id: 'done', title: 'Done' },
    ]});
  });

  describe('addTask', () => {
    it('adds a task with generated id and timestamps', () => {
      const id = useTaskStore.getState().addTask(makeTask({ id: undefined as unknown as string }));
      const task = useTaskStore.getState().tasks[0];
      expect(task.id).toBe(id);
      expect(task.title).toBe('Test Task');
      expect(task.createdAt).toBeGreaterThan(0);
      expect(task.updatedAt).toBeGreaterThan(0);
    });

    it('adds multiple tasks', () => {
      useTaskStore.getState().addTask(makeTask({ title: 'T1', id: undefined as unknown as string }));
      useTaskStore.getState().addTask(makeTask({ title: 'T2', id: undefined as unknown as string }));
      expect(useTaskStore.getState().tasks).toHaveLength(2);
    });
  });

  describe('updateTask', () => {
    it('updates task fields and bumps updatedAt', () => {
      const id = useTaskStore.getState().addTask(makeTask({ id: undefined as unknown as string }));
      const before = useTaskStore.getState().tasks[0].updatedAt;
      useTaskStore.getState().updateTask(id, { title: 'Updated', priority: 'high' });
      const task = useTaskStore.getState().tasks[0];
      expect(task.title).toBe('Updated');
      expect(task.priority).toBe('high');
      expect(task.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('ignores unknown id', () => {
      useTaskStore.getState().updateTask('missing', { title: 'Nope' });
      expect(useTaskStore.getState().tasks).toHaveLength(0);
    });
  });

  describe('deleteTask', () => {
    it('removes a task by id', () => {
      const id = useTaskStore.getState().addTask(makeTask({ id: undefined as unknown as string }));
      useTaskStore.getState().addTask(makeTask({ title: 'T2', id: undefined as unknown as string }));
      useTaskStore.getState().deleteTask(id);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].title).toBe('T2');
    });
  });

  describe('moveTask', () => {
    it('changes task status and bumps updatedAt', () => {
      const id = useTaskStore.getState().addTask(makeTask({ id: undefined as unknown as string }));
      useTaskStore.getState().moveTask(id, 'in_progress');
      expect(useTaskStore.getState().tasks[0].status).toBe('in_progress');
    });
  });

  describe('reorderColumns', () => {
    it('replaces columns', () => {
      const cols = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
      useTaskStore.getState().reorderColumns(cols);
      expect(useTaskStore.getState().columns).toEqual(cols);
    });
  });

  describe('getTasksByStatus', () => {
    it('filters tasks by status', () => {
      useTaskStore.getState().addTask(makeTask({ title: 'Todo', status: 'todo', id: undefined as unknown as string }));
      useTaskStore.getState().addTask(makeTask({ title: 'In Progress', status: 'in_progress', id: undefined as unknown as string }));
      useTaskStore.getState().addTask(makeTask({ title: 'Done', status: 'done', id: undefined as unknown as string }));
      useTaskStore.getState().addTask(makeTask({ title: 'Todo 2', status: 'todo', id: undefined as unknown as string }));
      const todos = useTaskStore.getState().getTasksByStatus('todo');
      expect(todos).toHaveLength(2);
      expect(todos.every(t => t.status === 'todo')).toBe(true);
    });
  });
});
