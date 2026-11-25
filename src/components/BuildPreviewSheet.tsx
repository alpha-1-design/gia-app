import React, { useState } from 'react';
import { X, RotateCcw, ExternalLink } from 'lucide-react';
import GIAInAppBrowser from '../services/GIAInAppBrowser';
import { useGiaStore } from '../store/useGiaStore';
import BottomSheet from './ui/BottomSheet';

interface BuildPreviewSheetProps {
  url: string | null;
  open: boolean;
  onClose: () => void;
}

// Migrated to the shared BottomSheet primitive (enter/exit, backdrop,
// grabber, drag-to-dismiss all come from it). Props and content unchanged.
// The iframe is sandboxed with allow-scripts ONLY — never allow-same-origin,
// because it renders untrusted LLM-generated HTML.
const BuildPreviewSheet: React.FC<BuildPreviewSheetProps> = ({ url, open, onClose }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const openInBrowser = async () => {
    if (!url) return;
    try {
      await GIAInAppBrowser.openPreview(url);
    } catch (error) {
      useGiaStore.getState().addNotification(
        `Could not open the in-app browser: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  };

  if (!url) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zIndex={150}
      maxHeight="85vh"
      className="h-[85vh] shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--gia-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: 'var(--gia-text)' }}>Preview</span>
        <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: 'var(--gia-muted)' }}>{url}</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--gia-surface-3)] active:bg-[var(--gia-surface-3)]"
          style={{ color: 'var(--gia-muted-2)' }}
          aria-label="Refresh preview"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={() => void openInBrowser()}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--gia-surface-3)] active:bg-[var(--gia-surface-3)]"
          style={{ color: 'var(--gia-muted-2)' }}
          aria-label="Open in browser"
        >
          <ExternalLink size={14} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--gia-surface-3)] active:bg-[var(--gia-surface-3)]"
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
        sandbox="allow-scripts"
        className="flex-1 w-full min-h-0 border-0 block"
        style={{ background: '#fff' }}
      />
    </BottomSheet>
  );
};

export default BuildPreviewSheet;
