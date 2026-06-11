import React from 'react';
import { clsx } from 'clsx';
import { Circle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

type StepStatus = 'pending' | 'running' | 'completed' | 'error';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
}

interface StepTimelineProps {
  steps: Step[];
  showDuration?: boolean;
}

const STATUS_ICONS: Record<StepStatus, React.FC<{ size?: number; className?: string }>> = {
  pending: ({ size = 16, className }) => <Circle size={size} className={className} />,
  running: ({ size = 16, className }) => <Clock size={size} className={className} />,
  completed: ({ size = 16, className }) => <CheckCircle2 size={size} className={className} />,
  error: ({ size = 16, className }) => <AlertTriangle size={size} className={className} />,
};

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'text-zinc-500',
  running: 'text-indigo-400 animate-pulse',
  completed: 'text-emerald-400',
  error: 'text-rose-400',
};

const STATUS_LINE_COLORS: Record<StepStatus, string> = {
  pending: 'bg-zinc-700',
  running: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  error: 'bg-rose-500',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const StepTimeline: React.FC<StepTimelineProps> = ({ steps, showDuration = true }) => {
  return (
    <div className="flex flex-col">
      {steps.map((step, idx) => {
        const Icon = STATUS_ICONS[step.status];
        const color = STATUS_COLORS[step.status];
        const lineColor = STATUS_LINE_COLORS[step.status];
        const isLast = idx === steps.length - 1;
        const isRunning = step.status === 'running';

        return (
          <div key={step.id} className="flex gap-3">
            {/* Icon + connecting line */}
            <div className="flex flex-col items-center">
              <div className={clsx('rounded-full p-0.5', color)}>
                <Icon size={16} className={color} />
              </div>
              {!isLast && (
                <div className={clsx('w-0.5 flex-1 min-h-[24px]', lineColor)} />
              )}
            </div>

            {/* Content */}
            <div className={clsx('pb-6 flex-1', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'text-sm font-medium',
                    step.status === 'completed' && 'text-zinc-200',
                    step.status === 'error' && 'text-rose-300',
                    step.status === 'running' && 'text-indigo-200',
                    step.status === 'pending' && 'text-zinc-500'
                  )}
                >
                  {step.label}
                </span>
                {isRunning && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                )}
              </div>
              {showDuration && step.durationMs !== undefined && step.status === 'completed' && (
                <span className="text-[11px] text-zinc-500">{formatDuration(step.durationMs)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StepTimeline;
