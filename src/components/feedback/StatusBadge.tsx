import React from 'react';
import { clsx } from 'clsx';
import { Wifi, WifiOff, Loader2, CheckCircle2, AlertTriangle, Circle } from 'lucide-react';

type BadgeStatus = 'online' | 'offline' | 'busy' | 'idle' | 'error' | 'success';

interface StatusBadgeProps {
  status: BadgeStatus;
  pulse?: boolean;
  label?: string;
}

const STATUS_CONFIG: Record<BadgeStatus, { icon: React.FC<{ size?: number }>; bg: string; text: string }> = {
  online:  { icon: Wifi,        bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  offline: { icon: WifiOff,     bg: 'bg-zinc-700',       text: 'text-zinc-400' },
  busy:    { icon: Loader2,     bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  idle:    { icon: Circle,      bg: 'bg-zinc-700',       text: 'text-zinc-500' },
  error:   { icon: AlertTriangle, bg: 'bg-rose-500/15',  text: 'text-rose-400' },
  success: { icon: CheckCircle2, bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, pulse = false, label }) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        pulse && 'animate-pulse'
      )}
    >
      <Icon size={12} />
      {label && <span>{label}</span>}
    </span>
  );
};

export default StatusBadge;
