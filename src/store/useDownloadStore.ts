import { create } from 'zustand';
import { aggregateProgress, monotonicPercent, type FileProgress } from '../utils/downloadProgress';

export type DownloadStatus = 'running' | 'done' | 'error';

export interface DownloadTask {
  id: string;
  label: string;
  status: DownloadStatus;
  percent: number;
  loaded: number;
  total: number;
  files: Record<string, FileProgress>;
  error?: string;
}

interface DownloadStore {
  tasks: Record<string, DownloadTask>;
  report: (id: string, label: string, file: string, progress: FileProgress, expectedTotal?: number) => void;
  finish: (id: string) => void;
  fail: (id: string, error: string) => void;
  dismiss: (id: string) => void;
}

/** Not persisted: a download that was running when the app died is not running any more. */
export const useDownloadStore = create<DownloadStore>((set) => ({
  tasks: {},
  report: (id, label, file, progress, expectedTotal = 0) => set(state => {
    const prev = state.tasks[id];
    const fresh = !prev || prev.status !== 'running';
    const files = { ...(fresh ? {} : prev.files), [file]: progress };
    const agg = aggregateProgress(files, expectedTotal);
    return {
      tasks: {
        ...state.tasks,
        [id]: {
          id, label, status: 'running', files,
          loaded: agg.loaded, total: agg.total,
          percent: fresh ? agg.percent : monotonicPercent(prev.percent, agg.percent),
        },
      },
    };
  }),
  finish: (id) => set(state => state.tasks[id]
    ? { tasks: { ...state.tasks, [id]: { ...state.tasks[id], status: 'done', percent: 100 } } }
    : state),
  fail: (id, error) => set(state => state.tasks[id]
    ? { tasks: { ...state.tasks, [id]: { ...state.tasks[id], status: 'error', error } } }
    : state),
  dismiss: (id) => set(state => {
    const rest = { ...state.tasks };
    delete rest[id];
    return { tasks: rest };
  }),
}));
