import React from 'react';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';

interface VisualHeaderProps {
  title?: string;
  onCopy: () => void;
  copied: boolean;
  onExpand?: () => void;
  expanded?: boolean;
}

export const VisualHeader: React.FC<VisualHeaderProps> = ({ title, onCopy, copied, onExpand, expanded }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-t-xl" style={{ background: 'var(--gia-surface-3)', borderBottom: '1px solid var(--gia-border)' }}>
    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>{title || 'Visualization'}</span>
    <div className="flex items-center gap-1">
      {onExpand && (
        <button onClick={onExpand} className="p-1 rounded transition-colors hover:bg-white/5" style={{ color: 'var(--gia-muted-2)' }}>
          {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>
      )}
      <button onClick={onCopy} className="p-1 rounded transition-colors hover:bg-white/5" style={{ color: 'var(--gia-muted-2)' }}>
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  </div>
);

interface VisualCardProps {
  title?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onCopy: () => void;
  copied: boolean;
  children: React.ReactNode;
}

export const VisualCard: React.FC<VisualCardProps> = ({ title, expanded, onToggle, onCopy, copied, children }) => (
  <div className="my-3 rounded-xl" style={{ border: '1px solid var(--gia-border)' }}>
    <VisualHeader title={title} onCopy={onCopy} copied={copied} onExpand={onToggle} expanded={expanded} />
    <div className="p-4" style={{ background: 'var(--gia-surface)' }}>
      {children}
    </div>
  </div>
);

export const ErrorVisual: React.FC<{ message: string }> = ({ message }) => (
  <div className="my-3 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
    {message}
  </div>
);


