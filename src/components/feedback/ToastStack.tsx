import React, { useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
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

// Motion tokens mirroring the CSS design system (globals.css):
// --ease-spring for entrances, --ease-standard for exits.
const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1];
const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-20 right-6 z-[100] flex flex-col-reverse gap-2 max-w-sm">
      {/* AnimatePresence keyed by toast id: rows slide in from the right and,
          critically, slide OUT again on dismissal — the old CSS class
          (animate-slide-in-right) never existed, so toasts had an entrance
          of nothing and no exit at all. */}
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
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
    <motion.div
      layout
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        config.bg,
        config.border
      )}
      role="alert"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2, ease: EASE_STANDARD } }}
      transition={{ duration: 0.25, ease: EASE_SPRING }}
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
    </motion.div>
  );
};

export default ToastStack;
