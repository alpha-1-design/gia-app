import React from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  status?: 'idle' | 'running' | 'completed' | 'error';
  showPercentage?: boolean;
}

const STATUS_STYLES: Record<string, { track: string; fill: string }> = {
  idle: { track: 'bg-zinc-700', fill: 'bg-zinc-500' },
  running: { track: 'bg-zinc-700', fill: 'bg-indigo-500' },
  completed: { track: 'bg-zinc-700', fill: 'bg-emerald-500' },
  error: { track: 'bg-zinc-700', fill: 'bg-rose-500' },
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  running: 'Running…',
  completed: 'Complete',
  error: 'Error',
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  status = 'idle',
  showPercentage = true,
}) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const style = STATUS_STYLES[status] || STATUS_STYLES.idle;

  return (
    <div className="flex flex-col gap-1 w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{label || STATUS_LABEL[status]}</span>
          {showPercentage && <span>{pct}%</span>}
        </div>
      )}
      <div className={clsx('w-full rounded-full h-2 overflow-hidden', style.track)}>
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300 ease-out',
            style.fill,
            status === 'running' && 'animate-pulse'
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
