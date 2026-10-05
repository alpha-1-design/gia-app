import React, { useEffect, useMemo } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { useDownloadStore, type DownloadTask } from '../store/useDownloadStore';
import { useGiaStore } from '../store/useGiaStore';
import { startDownloadTracking } from '../services/downloadTracker';
import { formatBytesShort } from '../utils/downloadProgress';

const SIZE = 60;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const LINGER_MS = 6000;

/** Ring that shows the live percentage, in the same neon-on-black style as the orb. */
export const ProgressRing: React.FC<{ task: DownloadTask; pulse: boolean }> = ({ task, pulse }) => {
  const done = task.status === 'done';
  const failed = task.status === 'error';
  const color = failed ? '#f87171' : done ? '#34d399' : '#22d3ee';
  const offset = CIRC * (1 - task.percent / 100);
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${color}88)` }} aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="#000814" stroke="#001233" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
          className={pulse && task.status === 'running' ? 'animate-pulse' : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        {done ? <Check size={22} aria-hidden /> : failed ? <AlertTriangle size={20} aria-hidden /> : (
          <span className="text-[13px] font-bold leading-none" style={{ textShadow: `0 0 10px ${color}99` }}>
            {task.percent}<span className="text-[8px] font-semibold">%</span>
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Small floating download indicator. Shows while a model is downloading and you
 * are somewhere other than Settings (where the full progress bar already is),
 * then turns into a check or a warning for a few seconds when it finishes.
 */
const FloatingDownload: React.FC = () => {
  const tasks = useDownloadStore(s => s.tasks);
  const currentModule = useGiaStore(s => s.currentModule);
  const reduceMotion = useGiaStore(s => s.reduceMotion);

  useEffect(() => { startDownloadTracking(); }, []);

  // Finished or failed tasks clear themselves.
  useEffect(() => {
    const timers = Object.values(tasks)
      .filter(t => t.status !== 'running')
      .map(t => setTimeout(() => useDownloadStore.getState().dismiss(t.id), LINGER_MS));
    return () => timers.forEach(clearTimeout);
  }, [tasks]);

  const list = useMemo(() => Object.values(tasks), [tasks]);
  const running = list.filter(t => t.status === 'running');
  const shown = running[0] ?? list[0];
  if (!shown) return null;
  if (shown.status === 'running' && currentModule === 'settings') return null;

  const extra = running.length > 1 ? running.length - 1 : 0;

  return (
    <button
      type="button"
      onClick={() => useGiaStore.getState().setModule('settings')}
      aria-label={
        shown.status === 'running' ? `${shown.label} downloading, ${shown.percent} percent. Tap to open settings.`
        : shown.status === 'done' ? `${shown.label} is ready.`
        : `${shown.label} download failed.`
      }
      role="status"
      className="fixed z-40 flex items-center gap-2 rounded-full pr-3"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)', right: 12, background: 'rgba(0,8,20,0.9)', border: '1px solid rgba(34,211,238,0.25)', backdropFilter: 'blur(10px)' }}
    >
      <ProgressRing task={shown} pulse={!reduceMotion} />
      <span className="flex flex-col items-start max-w-[120px]">
        <span className="text-[11px] font-medium truncate w-full" style={{ color: '#e0f2fe' }}>{shown.label}</span>
        <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
          {shown.status === 'running'
            ? `${formatBytesShort(shown.loaded)} / ${formatBytesShort(shown.total)}`
            : shown.status === 'done' ? 'Ready to use' : 'Failed'}
          {extra > 0 && ` · +${extra} more`}
        </span>
      </span>
    </button>
  );
};

export default FloatingDownload;
