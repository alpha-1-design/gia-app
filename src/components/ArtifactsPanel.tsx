import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Code, FileType, Image, MapIcon, Maximize2, X } from 'lucide-react';
import ArtifactRenderer from './ArtifactRenderer';
import type { Artifact } from '../store/useGiaStore';

interface Props {
  artifacts: Artifact[];
}

const typeIcon = (type: string) => {
  if (type === 'text/html' || type === 'html') return <Code size={12} />;
  if (type === 'image/svg+xml' || type === 'svg') return <Image size={12} />;
  if (type === 'application/vnd.mermaid' || type === 'mermaid') return <MapIcon size={12} />;
  return <FileType size={12} />;
};

const typeColor = (type: string) => {
  if (type === 'text/html' || type === 'html') return '#f59e0b';
  if (type === 'image/svg+xml' || type === 'svg') return '#22c55e';
  if (type === 'application/vnd.mermaid' || type === 'mermaid') return '#3b82f6';
  return '#a855f7';
};

const ArtifactsPanel: React.FC<Props> = ({ artifacts }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const active = artifacts[activeIdx];

  if (artifacts.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--gia-border)', background: 'var(--gia-surface-2)' }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid var(--gia-border)', background: 'var(--gia-surface-3)' }}>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {artifacts.length > 1 ? (
            <div className="flex gap-1 overflow-x-auto">
              {artifacts.map((art, i) => (
                <button
                  key={art.identifier}
                  onClick={() => setActiveIdx(i)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium whitespace-nowrap transition-colors"
                  style={{
                    background: i === activeIdx ? 'rgba(168,85,247,0.15)' : 'transparent',
                    color: i === activeIdx ? '#a855f7' : 'var(--gia-muted)',
                    border: i === activeIdx ? '1px solid rgba(168,85,247,0.2)' : '1px solid transparent',
                  }}
                >
                  {typeIcon(art.type)}
                  <span className="truncate max-w-[120px]">{art.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: typeColor(active?.type || '') }}>
              {active && typeIcon(active.type)}
              <span>{active?.title}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCanvasOpen(true)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors hover:opacity-70"
          style={{ color: 'var(--gia-muted-2)' }}
          title="Open in Canvas"
        >
          <Maximize2 size={11} /> Canvas
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[9px] px-1.5 py-0.5 rounded transition-colors hover:opacity-70"
          style={{ color: 'var(--gia-muted-2)' }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed && active && (
        <motion.div
          key={active.identifier}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3"
        >
          <ArtifactRenderer type={active.type} content={active.content} title={active.title} />
        </motion.div>
      )}
      {canvasOpen && active && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: 'var(--gia-bg)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--gia-border)', background: 'var(--gia-surface)' }}>
              <div className="flex items-center gap-2 min-w-0">
                {typeIcon(active.type)}
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{active.title}</span>
              </div>
              <button
                onClick={() => setCanvasOpen(false)}
                className="p-2 rounded-xl tap-feedback transition-colors hover:bg-white/10"
                style={{ color: 'var(--gia-muted)' }}
                title="Close Canvas"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ArtifactRenderer type={active.type} content={active.content} title={active.title} />
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default React.memo(ArtifactsPanel);
