import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GiaTask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
  /** Epoch ms when the task reached 'done'; cleared whenever the status
   *  leaves 'done' so the timestamp always reflects the latest completion. */
  completedAt?: number;
}

interface TaskState {
  tasks: GiaTask[];
  columns: { id: string; title: string }[];
  addTask: (task: Omit<GiaTask, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTask: (id: string, updates: Partial<GiaTask>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: GiaTask['status']) => void;
  reorderColumns: (columns: { id: string; title: string }[]) => void;
  getTasksByStatus: (status: GiaTask['status']) => GiaTask[];
}

/** Shared completedAt policy: set when a task lands on 'done' (an explicit
 *  completedAt in the update wins), cleared when it leaves 'done'. */
function applyCompletedAt<T extends { status: GiaTask['status']; completedAt?: number; updatedAt: number }>(
  task: T,
  now: number,
): T {
  if (task.status === 'done') {
    return { ...task, completedAt: task.completedAt ?? now };
  }
  const { completedAt: _cleared, ...rest } = task;
  void _cleared;
  return rest as T;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      columns: [
        { id: 'todo', title: 'To Do' },
        { id: 'in_progress', title: 'In Progress' },
        { id: 'done', title: 'Done' },
      ],

      addTask: (task) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((s) => ({
          tasks: [...s.tasks, { ...task, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },

      updateTask: (id, updates) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const now = Date.now();
            const next = { ...t, ...updates, updatedAt: now };
            if (updates.status && updates.status !== t.status) {
              return applyCompletedAt(next, now);
            }
            return next;
          }),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      moveTask: (taskId: string, newStatus: GiaTask['status']) =>
        set((s: TaskState) => ({
          tasks: s.tasks.map((t: GiaTask) => {
            if (t.id !== taskId) return t;
            const now = Date.now();
            return applyCompletedAt({ ...t, status: newStatus, updatedAt: now }, now);
          }),
        })),

      reorderColumns: (columns: { id: string; title: string }[]) => set({ columns }),

      getTasksByStatus: (status: GiaTask['status']) => get().tasks.filter((t: GiaTask) => t.status === status),
    }),
    {
      name: 'gia-tasks-v1',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
