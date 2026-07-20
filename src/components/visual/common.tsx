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
  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'var(--gia-surface-3)', borderBottom: '1px solid var(--gia-border)' }}>
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--gia-accent)' }} />
      <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--gia-muted)' }}>{title || 'Visualization'}</span>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {onExpand && (
        <button onClick={onExpand} className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15" style={{ color: 'var(--gia-muted-2)' }} aria-label={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      )}
      <button onClick={onCopy} className="p-1.5 rounded-lg transition-colors hover:bg-white/10 active:bg-white/15" style={{ color: 'var(--gia-muted-2)' }} aria-label="Copy">
        {copied ? <Check size={12} /> : <Copy size={12} />}
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
    <div className="my-3 rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)]" style={{ border: '1px solid var(--gia-border)', background: 'var(--gia-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
    <VisualHeader title={title} onCopy={onCopy} copied={copied} onExpand={onToggle} expanded={expanded} />
    <div className="p-4">{children}</div>
  </div>
);

export const ErrorVisual: React.FC<{ message: string }> = ({ message }) => (
  <div className="my-3 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
    {message}
  </div>
);

export const VisualLoading: React.FC<{ label?: string }> = ({ label }) => (
  <div className="my-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--gia-border)', background: 'var(--gia-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}>
    <VisualHeader title="Visualization" onCopy={() => {}} copied={false} />
    <div className="p-4 flex items-center gap-3">
      <span className="w-4 h-4 rounded-full border-2 border-[var(--gia-accent)] border-t-transparent animate-spin shrink-0" aria-hidden />
      <span className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>{label || 'Generating visualization…'}</span>
    </div>
  </div>
);
