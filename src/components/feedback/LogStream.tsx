import React, { useRef, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, Info, XCircle, Bug } from 'lucide-react';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: string;
}

interface LogStreamProps {
  entries: LogEntry[];
  maxHeight?: string;
  filter?: string;
}

const LEVEL_ICONS: Record<LogLevel, React.FC<{ size?: number; className?: string }>> = {
  info:  ({ size, className }) => <Info size={size} className={className} />,
  warn:  ({ size, className }) => <AlertTriangle size={size} className={className} />,
  error: ({ size, className }) => <XCircle size={size} className={className} />,
  debug: ({ size, className }) => <Bug size={size} className={className} />,
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  info:  'text-zinc-300 border-l-indigo-500',
  warn:  'text-amber-300 border-l-amber-500',
  error: 'text-rose-300 border-l-rose-500',
  debug: 'text-zinc-500 border-l-zinc-600',
};

const LEVEL_BG: Record<LogLevel, string> = {
  info:  'bg-zinc-800/30',
  warn:  'bg-amber-900/20',
  error: 'bg-rose-900/20',
  debug: 'bg-zinc-800/10',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const LogStream: React.FC<LogStreamProps> = ({ entries, maxHeight = '320px', filter }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!filter) return entries;
    const lower = filter.toLowerCase();
    return entries.filter(
      (e) =>
        e.message.toLowerCase().includes(lower) ||
        e.level.toLowerCase().includes(lower) ||
        (e.data && e.data.toLowerCase().includes(lower))
    );
  }, [entries, filter]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered]);

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto font-mono text-xs rounded-lg border border-zinc-800 bg-zinc-950"
      style={{ maxHeight }}
    >
      {filtered.length === 0 && (
        <div className="flex items-center justify-center h-24 text-zinc-600 italic">
          No log entries
        </div>
      )}
      {filtered.map((entry, i) => {
        const Icon = LEVEL_ICONS[entry.level];
        const style = LEVEL_STYLES[entry.level];
        const bg = LEVEL_BG[entry.level];

        return (
          <div
            key={`${entry.timestamp}-${i}`}
            className={clsx(
              'flex items-start gap-2 px-3 py-1.5 border-l-2 hover:bg-zinc-800/40 transition-colors',
              bg,
              style
            )}
          >
            <span className="shrink-0 text-zinc-600 w-16">{formatTimestamp(entry.timestamp)}</span>
            <span className="shrink-0 w-4 mt-0.5">
              <Icon size={12} />
            </span>
            <span className="flex-1 break-words">{entry.message}</span>
            {entry.data && (
              <span className="shrink-0 text-zinc-600 max-w-[200px] truncate" title={entry.data}>
                {entry.data}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LogStream;
