import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockTasks: { id: string; title: string; status: string; priority: string; tags: string[]; dueDate: string | null; createdAt: number; updatedAt: number }[] = [];

vi.mock('../../store/useTaskStore', () => ({
  useTaskStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: () => ({
        tasks: mockTasks,
        addTask: vi.fn((task: { title: string; status: string }) => {
          const id = 'task-' + mockTasks.length;
          mockTasks.push({ id, ...task, priority: 'medium', tags: [], dueDate: null, createdAt: Date.now(), updatedAt: Date.now() });
          return id;
        }),
        updateTask: vi.fn((id: string, updates: Record<string, unknown>) => {
          const idx = mockTasks.findIndex(t => t.id === id);
          if (idx >= 0) mockTasks[idx] = { ...mockTasks[idx], ...updates } as typeof mockTasks[0];
        }),
        deleteTask: vi.fn((id: string) => { mockTasks = mockTasks.filter(t => t.id !== id); }),
        moveTask: vi.fn((id: string, status: string) => {
          const idx = mockTasks.findIndex(t => t.id === id);
          if (idx >= 0) mockTasks[idx].status = status;
        }),
        getTasksByStatus: vi.fn((status: string) => mockTasks.filter(t => t.status === status)),
      }),
    }
  ),
}));

const { taskTools } = await import('../tools/tasks');

describe('task tools', () => {
  beforeEach(() => {
    mockTasks = [];
  });

  describe('task_create', () => {
    const createTool = taskTools.find(t => t.id === 'task_create')!;

    it('creates a task with title', async () => {
      const result = await createTool.execute({ title: 'Test Task', priority: 'high', tags: ['urgent'] });
      expect(result.success).toBe(true);
      expect(result.content).toContain('Test Task');
    });

    it('fails on empty title', async () => {
      const result = await createTool.execute({ title: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('title is required');
    });
  });

  describe('task_read', () => {
    const readTool = taskTools.find(t => t.id === 'task_read')!;

    it('reads a task by ID', async () => {
      mockTasks.push({ id: 't1', title: 'My Task', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await readTool.execute({ id: 't1' });
      expect(result.success).toBe(true);
      expect(result.content).toContain('My Task');
    });

    it('returns error for missing task', async () => {
      const result = await readTool.execute({ id: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('lists all tasks when no id or status', async () => {
      mockTasks.push({ id: 't1', title: 'A', status: 'todo', priority: 'low', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      mockTasks.push({ id: 't2', title: 'B', status: 'done', priority: 'high', tags: [], dueDate: null, createdAt: 2, updatedAt: 2 });
      const result = await readTool.execute({});
      expect(result.success).toBe(true);
      expect(result.content).toContain('A');
      expect(result.content).toContain('B');
    });

    it('filters by status', async () => {
      mockTasks.push({ id: 't1', title: 'Todo', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      mockTasks.push({ id: 't2', title: 'Done', status: 'done', priority: 'high', tags: [], dueDate: null, createdAt: 2, updatedAt: 2 });
      const result = await readTool.execute({ status: 'todo' });
      expect(result.content).toContain('Todo');
      expect(result.content).not.toContain('Done');
    });
  });

  describe('task_update', () => {
    const updateTool = taskTools.find(t => t.id === 'task_update')!;

    it('updates an existing task', async () => {
      mockTasks.push({ id: 't1', title: 'Old', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await updateTool.execute({ id: 't1', title: 'New', priority: 'high' });
      expect(result.success).toBe(true);
      expect(mockTasks[0].title).toBe('New');
    });

    it('fails on missing task', async () => {
      const result = await updateTool.execute({ id: 'missing', title: 'Nope' });
      expect(result.success).toBe(false);
    });

    it('fails with no updates', async () => {
      mockTasks.push({ id: 't1', title: 'Old', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await updateTool.execute({ id: 't1' });
      expect(result.success).toBe(false);
    });
  });

  describe('task_delete', () => {
    const deleteTool = taskTools.find(t => t.id === 'task_delete')!;

    it('deletes an existing task', async () => {
      mockTasks.push({ id: 't1', title: 'Delete Me', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await deleteTool.execute({ id: 't1' });
      expect(result.success).toBe(true);
      expect(mockTasks).toHaveLength(0);
    });

    it('fails on missing task', async () => {
      const result = await deleteTool.execute({ id: 'missing' });
      expect(result.success).toBe(false);
    });
  });

  describe('task_move', () => {
    const moveTool = taskTools.find(t => t.id === 'task_move')!;

    it('moves task to a valid status', async () => {
      mockTasks.push({ id: 't1', title: 'Move Me', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await moveTool.execute({ id: 't1', status: 'in_progress' });
      expect(result.success).toBe(true);
      expect(mockTasks[0].status).toBe('in_progress');
    });

    it('fails on invalid status', async () => {
      mockTasks.push({ id: 't1', title: 'Move Me', status: 'todo', priority: 'medium', tags: [], dueDate: null, createdAt: 1, updatedAt: 1 });
      const result = await moveTool.execute({ id: 't1', status: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('fails on missing task', async () => {
      const result = await moveTool.execute({ id: 'missing', status: 'done' });
      expect(result.success).toBe(false);
    });
  });
});
