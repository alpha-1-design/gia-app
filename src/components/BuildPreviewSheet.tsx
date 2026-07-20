import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, ExternalLink } from 'lucide-react';

interface BuildPreviewSheetProps {
  url: string | null;
  open: boolean;
  onClose: () => void;
}

const BuildPreviewSheet: React.FC<BuildPreviewSheetProps> = ({ url, open, onClose }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AnimatePresence>
      {open && url && (
        <>
          <motion.div
            className="fixed inset-0 z-[150]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[151] flex flex-col rounded-t-2xl overflow-hidden"
            style={{ height: '85vh', background: '#0a0a0a', borderTop: '1px solid #f9731640', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: '#f97316' }}>Preview</span>
              <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: 'var(--gia-muted)' }}>{url}</span>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15"
                style={{ color: 'var(--gia-muted-2)' }}
                aria-label="Refresh preview"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => window.open(url, '_blank')}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15"
                style={{ color: 'var(--gia-muted-2)' }}
                aria-label="Open in browser"
              >
                <ExternalLink size={14} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15"
                style={{ color: 'var(--gia-muted-2)' }}
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
            <iframe
              key={refreshKey}
              src={url}
              title="App preview"
              className="flex-1 w-full border-0 block"
              style={{ background: '#fff' }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BuildPreviewSheet;
