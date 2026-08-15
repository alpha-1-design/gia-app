import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ToolItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  color: string;
}

interface ComposerToolsSheetProps {
  open: boolean;
  onClose: () => void;
  items: ToolItem[];
  onToggle: (key: string) => void;
  /** Optional extra rows rendered below the toggles (e.g. All Tools, active skill). */
  footer?: React.ReactNode;
}

const Switch: React.FC<{ active: boolean; color: string }> = ({ active, color }) => (
  <span
    className="relative inline-block w-9 h-5 rounded-full transition-colors shrink-0"
    style={{ background: active ? color : 'var(--gia-border)' }}
  >
    <motion.span
      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white"
      animate={{ x: active ? 16 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
    />
  </span>
);

export const ComposerToolsSheet: React.FC<ComposerToolsSheetProps> = ({ open, onClose, items, onToggle, footer }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[61] rounded-t-2xl overflow-hidden"
            style={{ background: 'var(--gia-surface)', borderTop: '1px solid var(--gia-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
                Tools &amp; Modes
              </span>
              <button onClick={onClose} className="p-1 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="w-10 h-1 rounded-full mx-auto my-2" style={{ background: 'var(--gia-border)' }} />

            <div className="max-h-[60vh] overflow-y-auto pb-2">
              {items.map(item => (
                <button
                  key={item.key}
                  onClick={() => onToggle(item.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-[14px] tap-feedback transition-colors active:bg-white/5"
                  style={{ color: 'var(--gia-text)' }}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: item.active ? `${item.color}20` : 'var(--gia-surface-2)', color: item.active ? item.color : 'var(--gia-muted)' }}
                  >
                    <item.icon size={15} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <Switch active={item.active} color={item.color} />
                </button>
              ))}
              {footer && (
                <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--gia-border)', marginTop: 4 }}>
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ComposerToolsSheet;
