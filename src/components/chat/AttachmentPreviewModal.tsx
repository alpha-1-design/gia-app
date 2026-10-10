import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Pencil, RotateCcw, Trash2, Check, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import type { Attachment } from '../../hooks/useFileAttachments';

const RegionSelectorOverlay = lazy(() =>
  import('../RegionSelectorOverlay').then((m) => ({ default: m.RegionSelectorOverlay })),
);

const PREVIEW_LIMIT = 5000;

interface AttachmentPreviewModalProps {
  attachment: Attachment;
  onClose: () => void;
  onReplace: (next: Attachment) => void;
  onRemove: () => void;
}

const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
};

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  attachment,
  onClose,
  onReplace,
  onRemove,
}) => {
  const [circling, setCircling] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const imageSrc = attachment.error ? undefined : attachment.preview;
  const edited = Boolean(attachment.original);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (circling && imageSrc) {
    return (
      <Suspense fallback={null}>
        <RegionSelectorOverlay
          imageSrc={imageSrc}
          confirmLabel="Use circled area"
          hint="Circle the part you want GIA to focus on — it snaps to edges"
          onSelect={(cropped) => {
            onReplace({
              ...attachment,
              original: attachment.original ?? imageSrc,
              preview: cropped,
            });
            setCircling(false);
          }}
          onCancel={() => setCircling(false)}
        />
      </Suspense>
    );
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[95] flex items-center justify-center sm:p-6"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-3xl overflow-hidden sm:rounded-3xl"
        style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}
          >
            {imageSrc ? <ImageIcon size={16} /> : <FileText size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{attachment.name}</p>
            <p className="text-[11px] truncate flex items-center gap-2" style={{ color: 'var(--gia-muted)' }}>
              <span>{attachment.type || 'file'}</span>
              {edited && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc' }}
                >
                  Edited
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-muted)' }}
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {attachment.error ? (
          <div className="flex-1 min-h-[40vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle size={28} style={{ color: '#f87171' }} />
            <p role="alert" className="text-sm max-w-md" style={{ color: 'var(--gia-muted)' }}>{attachment.error}</p>
          </div>
        ) : imageSrc ? (
          <div
            className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-4 h-[55vh] sm:h-[62vh]"
            style={CHECKERBOARD}
          >
            <img src={imageSrc} alt={attachment.name} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto px-4 py-3 h-[55vh] sm:h-[62vh]">
            <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words font-mono" style={{ color: 'var(--gia-text)' }}>
              {attachment.content.slice(0, showFullText ? undefined : PREVIEW_LIMIT)}
              {!showFullText && attachment.content.length > PREVIEW_LIMIT ? '…' : ''}
            </pre>
            {attachment.content.length > PREVIEW_LIMIT && (
              <button
                onClick={() => setShowFullText((v) => !v)}
                className="mt-3 text-[11px] font-medium underline"
                style={{ color: '#a855f7' }}
              >
                {showFullText ? 'Show less' : `Show all (${attachment.content.length.toLocaleString()} chars)`}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={onRemove}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10"
            style={{ color: '#f87171' }}
          >
            <Trash2 size={14} /> Remove
          </button>
          <div className="flex items-center gap-2">
            {edited && (
              <button
                onClick={() => onReplace({ ...attachment, preview: attachment.original, original: undefined })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gia-muted)' }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
            {imageSrc && (
              <button
                onClick={() => setCircling(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white' }}
              >
                <Pencil size={14} /> Circle region
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--gia-text)' }}
            >
              <Check size={14} /> Done
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
};

export default AttachmentPreviewModal;
