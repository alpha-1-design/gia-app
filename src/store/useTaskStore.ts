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
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        })),

      deleteTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      moveTask: (taskId: string, newStatus: GiaTask['status']) =>
        set((s: TaskState) => ({
          tasks: s.tasks.map((t: GiaTask) =>
            t.id === taskId ? { ...t, status: newStatus, updatedAt: Date.now() } : t
          ),
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
