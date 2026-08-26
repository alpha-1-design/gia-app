import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'motion/react';
import { shouldDismissFromLeftDrag } from './dragDismiss';

interface LeftDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  zIndex?: number;
}

// Mirrors BottomSheet's drag-to-dismiss pattern but on the x-axis (see
// dragDismiss.ts for the actual threshold logic and why it's split out).

export const LeftDrawer: React.FC<LeftDrawerProps> = ({
  open,
  onClose,
  children,
  width = '84vw',
  zIndex = 130,
}) => {
  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    if (shouldDismissFromLeftDrag(info)) {
      onClose();
    }
  };

  const reduceMotion = useReducedMotion();

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
            className="fixed inset-y-0 left-0 overflow-hidden flex flex-col"
            style={{
              zIndex: zIndex + 1,
              width,
              maxWidth: '340px',
              background: 'var(--gia-surface)',
              borderRight: '1px solid var(--gia-border)',
              // fixed positioning escapes #root's own safe-area padding (it's
              // relative to the real viewport, not the padded box), so with
              // edge-to-edge status bar overlay this drawer's content would
              // otherwise start underneath/behind it. Pad it directly.
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            initial={{ x: reduceMotion ? 0 : '-100%', opacity: reduceMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduceMotion ? 0 : '-100%', opacity: reduceMotion ? 0 : 1 }}
            // Softer spring: less overshoot and no rubber-band wobble while
            // dragging, so the drawer glides instead of snapping.
            transition={reduceMotion
              ? { duration: 0.15, ease: 'easeOut' }
              : { type: 'spring', stiffness: 240, damping: 30, mass: 0.9 }}
            drag={reduceMotion ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.12, right: 0 }}
            onDragEnd={handleDragEnd}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LeftDrawer;
