import React from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
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
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0 }}
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
