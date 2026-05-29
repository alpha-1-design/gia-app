import { useMemo, useState, useRef, useCallback } from 'react';
import { GiaTask, useTaskStore, TaskPriority } from '../store/useTaskStore';
import { Sparkles, Plus, Trash2, GripVertical, Clock, Tag } from 'lucide-react';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'border-t-2 border-t-gray-400 dark:border-t-gray-600',
  in_progress: 'border-t-2 border-t-blue-500',
  done: 'border-t-2 border-t-green-500',
};

function TaskCard({
  task,
  onDragStart,
}: {
  task: GiaTask;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}) {
  const { updateTask, deleteTask } = useTaskStore();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  const handleSave = () => {
    if (title.trim()) {
      updateTask(task.id, { title: title.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group animate-in-slide"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full text-sm font-medium bg-transparent border-b border-blue-500 outline-none px-0 py-0.5"
              autoFocus
            />
          ) : (
            <div
              className="text-sm font-medium cursor-pointer"
              onDoubleClick={() => {
                setTitle(task.title);
                setEditing(true);
              }}
            >
              {task.title}
            </div>
          )}
          {task.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </span>
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-0.5"
              >
                <Tag size={8} />
                {tag}
              </span>
            ))}
            {task.dueDate && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                <Clock size={8} />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => deleteTask(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
        >
          <Trash2 size={12} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

function AddTaskForm({ status, onClose }: { status: GiaTask['status']; onClose: () => void }) {
  const { addTask } = useTaskStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({ title: title.trim(), description, status, priority, tags: [], dueDate: null });
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        className="w-full text-sm border-b border-gray-200 dark:border-gray-600 bg-transparent outline-none pb-1 placeholder:text-gray-400"
        autoFocus
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full text-xs border border-gray-200 dark:border-gray-600 bg-transparent outline-none p-1.5 rounded placeholder:text-gray-400 resize-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded bg-transparent p-1"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
}

export function TaskBoard() {
  const { tasks, columns, moveTask, deleteTask } = useTaskStore();
  const [addingTo, setAddingTo] = useState<GiaTask['status'] | null>(null);
  const [search, setSearch] = useState('');
  const dragOverCol = useRef<string | null>(null);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  const tasksByStatus = useMemo(() => {
    const map: Record<string, GiaTask[]> = { todo: [], in_progress: [], done: [] };
    filteredTasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [filteredTasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverCol.current = status;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, status: GiaTask['status']) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) moveTask(taskId, status);
      dragOverCol.current = null;
    },
    [moveTask]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-500" />
          <span className="font-semibold text-sm">Task Board</span>
          <span className="text-xs text-gray-400">
            {stats.done}/{stats.total} · {stats.pct}%
          </span>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-transparent outline-none w-40 placeholder:text-gray-400"
        />
      </div>
      <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
        {columns.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id as GiaTask['status'])}
            className={`flex-1 min-w-[280px] max-w-[360px] flex flex-col rounded-xl bg-gray-50 dark:bg-gray-900/50 ${STATUS_COLORS[col.id]} ${
              dragOverCol.current === col.id
                ? 'ring-2 ring-blue-400 dark:ring-blue-600 bg-blue-50 dark:bg-blue-900/10'
                : ''
            } transition-all`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {col.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">
                  {tasksByStatus[col.id]?.length || 0}
                </span>
              </div>
              <button
                onClick={() => setAddingTo(col.id as GiaTask['status'])}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px]">
              {tasksByStatus[col.id]?.map((task) => (
                <TaskCard key={task.id} task={task} onDragStart={handleDragStart} />
              ))}
              {addingTo === col.id && (
                <AddTaskForm status={col.id as GiaTask['status']} onClose={() => setAddingTo(null)} />
              )}
              {tasksByStatus[col.id]?.length === 0 && addingTo !== col.id && (
                <div className="text-xs text-gray-400 text-center py-8">Drop tasks here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
