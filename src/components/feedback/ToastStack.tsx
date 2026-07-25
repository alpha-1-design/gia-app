import React, { useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const TOAST_CONFIG: Record<ToastType, { icon: React.FC<{ size?: number }>; bg: string; border: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-900/60', border: 'border-emerald-700', iconColor: 'text-emerald-400' },
  error:   { icon: XCircle,      bg: 'bg-rose-900/60',    border: 'border-rose-700',   iconColor: 'text-rose-400' },
  info:    { icon: Info,          bg: 'bg-indigo-900/60',  border: 'border-indigo-700', iconColor: 'text-indigo-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-900/60',  border: 'border-amber-700',  iconColor: 'text-amber-400' },
};

const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-20 right-6 z-[100] flex flex-col-reverse gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const config = TOAST_CONFIG[toast.type];

  const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  useEffect(() => {
    const dur = toast.duration ?? 4000;
    if (dur <= 0) return;
    const timer = setTimeout(dismiss, dur);
    return () => clearTimeout(timer);
  }, [dismiss, toast.duration]);

  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-slide-in-right transition-all duration-300',
        config.bg,
        config.border
      )}
      role="alert"
    >
      <div className={clsx('shrink-0 mt-0.5', config.iconColor)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{toast.message}</p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ToastStack;
