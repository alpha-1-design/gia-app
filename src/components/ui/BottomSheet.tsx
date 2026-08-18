import React from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import { shouldDismissFromDrag } from './dragDismiss';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max height as a CSS value, e.g. '78vh'. Defaults to '85vh'. */
  maxHeight?: string;
  className?: string;
  zIndex?: number;
}

// Every slide-up panel in GIA used to hand-roll its own backdrop + motion.div
// with no way to dismiss it except tapping the X — dragging down did nothing,
// which reads as broken on a phone where swipe-to-dismiss is the expected
// gesture for almost every other sheet/modal. This is the shared primitive:
// drag it down past a distance/velocity threshold (or just let go with some
// downward momentum) and it closes, same as the OS-level sheets people are
// used to. New sheets should use this instead of duplicating the animation
// wiring; existing ones (ModelSwitcherSheet, EngineSheet) have been migrated,
// the rest (BuildPreviewSheet, ComposerToolsSheet, MessageActionSheet,
// ClarificationBottomSheet, ToolsCatalogSheet) still need the same migration.
// Extracted as a pure function (dragDismiss.ts) so the actual dismiss
// threshold is unit testable without needing jsdom to simulate real
// framer-motion drag physics (which it can't do reliably).

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  maxHeight = '85vh',
  className = '',
  zIndex = 120,
}) => {
  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (shouldDismissFromDrag(info)) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            style={{ zIndex }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`fixed inset-x-0 bottom-0 rounded-t-3xl overflow-hidden flex flex-col ${className}`}
            style={{
              zIndex: zIndex + 1,
              background: 'var(--gia-surface)',
              borderTop: '1px solid var(--gia-border)',
              maxHeight,
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
          >
            {/* Grabber handle — the visual affordance that this is draggable */}
            <div className="flex justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-9 h-1 rounded-full" style={{ background: 'var(--gia-border)' }} />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
