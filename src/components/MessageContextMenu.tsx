import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Pencil, RotateCcw, Trash2, GitFork, Play } from 'lucide-react';
import { motion } from 'motion/react';

interface MenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  color?: string;
}

interface Props {
  messageId: string;
  content: string;
  isUser: boolean;
  canFork: boolean;
  onCopy: (id: string, content: string) => void;
  onEdit?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete: (id: string) => void;
  onFork?: (id: string) => void;
  onContinue?: (id: string) => void;
  children: React.ReactNode;
}

const MessageContextMenu: React.FC<Props> = ({
  messageId, content, isUser, canFork,
  onCopy, onEdit, onRetry, onDelete, onFork, onContinue,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  // Store where the touch actually happened for accurate positioning
  const touchPointRef = useRef({ x: 0, y: 0 });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleScroll = () => close();
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, close]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressRef.current = setTimeout(() => {
      setOpen(true);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    touchPointRef.current = { x: 0, y: 0 };
    setPos({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  const getAdjustedPos = () => {
    const menuWidth = 160;
    const menuHeight = isUser ? 120 : onContinue ? 200 : 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // For touch events, position menu near the actual touch point, not the message edge
    const touchPt = touchPointRef.current;
    if (touchPt.x > 0 || touchPt.y > 0) {
      const spaceBelow = vh - touchPt.y - 16;
      const spaceAbove = touchPt.y - 16;
      let y: number;
      if (spaceBelow >= menuHeight) {
        y = touchPt.y + 8;
      } else if (spaceAbove >= menuHeight) {
        y = touchPt.y - menuHeight - 8;
      } else {
        y = spaceBelow > spaceAbove ? touchPt.y + 8 : Math.max(16, touchPt.y - menuHeight - 8);
      }
      const x = Math.min(touchPt.x, vw - menuWidth - 16);
      return { x: Math.max(16, x), y };
    }
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const spaceBelow = vh - triggerRect.bottom - 16;
      const spaceAbove = triggerRect.top - 16;
      let y: number;
      if (spaceBelow >= menuHeight) {
        y = triggerRect.bottom;
      } else if (spaceAbove >= menuHeight) {
        y = triggerRect.top - menuHeight;
      } else {
        y = spaceBelow > spaceAbove ? triggerRect.bottom : Math.max(16, triggerRect.top - menuHeight);
      }
      // Position near the right edge of trigger for mouse — more natural for desktop
      const x = Math.min(triggerRect.right - menuWidth, vw - menuWidth - 16);
      return { x: Math.max(16, x), y };
    }
    return {
      x: Math.min(pos.x, vw - menuWidth - 16),
      y: Math.min(pos.y, vh - menuHeight - 16),
    };
  };

  const adjustedPos = useMemo(() => open ? getAdjustedPos() : { x: 0, y: 0 }, [open, pos.x, pos.y, isUser, onContinue]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions: MenuAction[] = [
    { id: 'copy', label: 'Copy', icon: <Copy size={13} />, action: () => { onCopy(messageId, content); close(); } },
  ];

  if (onEdit && isUser) {
    actions.push({ id: 'edit', label: 'Edit', icon: <Pencil size={13} />, action: () => { onEdit(messageId); close(); } });
  }
  if (onRetry && !isUser) {
    actions.push({ id: 'retry', label: 'Retry', icon: <RotateCcw size={13} />, action: () => { onRetry(messageId); close(); } });
  }
  if (onContinue && !isUser) {
    actions.push({ id: 'continue', label: 'Continue', icon: <Play size={13} />, action: () => { onContinue(messageId); close(); } });
  }
  if (onFork && canFork) {
    actions.push({ id: 'fork', label: 'Fork', icon: <GitFork size={13} />, action: () => { onFork(messageId); close(); } });
  }
  actions.push({ id: 'delete', label: 'Delete', icon: <Trash2 size={13} />, action: () => { onDelete(messageId); close(); }, color: '#f87171' });

  return (
    <>
      <div
        ref={triggerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className="context-menu-trigger"
      >
        {children}
      </div>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 w-40 rounded-xl overflow-hidden shadow-2xl"
            style={{
              left: adjustedPos.x,
              top: adjustedPos.y,
              background: '#1a1a24',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="py-1">
              {actions.map((a, i) => (
                <React.Fragment key={a.id}>
                  {i > 0 && i === actions.length - 1 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2px 8px' }} />}
                  <button
                    onClick={a.action}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors tap-feedback"
                    style={{ color: a.color || 'var(--gia-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </>
  );
};

export default React.memo(MessageContextMenu);
