import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';

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

// Migrated to the shared BottomSheet primitive: enter/exit, backdrop,
// grabber and drag-to-dismiss all come from it — this component only
// renders its rows. Props and content are unchanged.
export const ComposerToolsSheet: React.FC<ComposerToolsSheetProps> = ({ open, onClose, items, onToggle, footer }) => {
  return (
    <BottomSheet open={open} onClose={onClose} zIndex={60} className="pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-4 pt-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>
          Tools &amp; Modes
        </span>
        <button onClick={onClose} className="p-1 rounded-lg tap-feedback" style={{ color: 'var(--gia-muted)' }} aria-label="Close tools">
          <X size={18} />
        </button>
      </div>

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
    </BottomSheet>
  );
};

export default ComposerToolsSheet;
