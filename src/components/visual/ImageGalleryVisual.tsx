import React, { useState, useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface GalleryData {
  images?: { url?: string; caption?: string }[];
  title?: string;
  columns?: number;
}

export const ImageGalleryVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as GalleryData;
  const images = d.images;
  const title = d.title;
  const columns = d.columns || 3;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const copyData = useCallback(() => copy(images?.map((img: { url?: string; caption?: string }) => img.url || String(img)).join('\n') || ''), [images, copy]);

  if (!images?.length) return null;

  return (
    <VisualCard title={title || 'Gallery'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(columns, images.length)}, 1fr)` }}>
        {images.map((img: { url?: string; caption?: string }, i: number) => {
          const url = img.url || String(img);
          const caption = img.caption || '';
          return (
            <div key={i} onClick={() => setViewerIdx(i)} className="relative rounded-lg overflow-hidden cursor-pointer group" style={{ border: '1px solid var(--gia-border)', aspectRatio: '1' }}>
              <img src={url} alt={caption} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              {caption && <div className="absolute bottom-0 left-0 right-0 p-1.5 text-[8px]" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white' }}>{caption}</div>}
            </div>
          );
        })}
      </div>
      {viewerIdx !== null && (
        <div onClick={() => setViewerIdx(null)} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={images[viewerIdx].url || String(images[viewerIdx])} alt="" className="max-w-full max-h-[85vh] rounded-xl" style={{ border: '1px solid var(--gia-border)' }} />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2">
                <button onClick={() => setViewerIdx(i => Math.max(0, i! - 1))} disabled={viewerIdx === 0} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)', color: viewerIdx === 0 ? 'var(--gia-muted-2)' : 'white' }}>← Prev</button>
                <button onClick={() => setViewerIdx(i => Math.min(images.length - 1, i! + 1))} disabled={viewerIdx >= images.length - 1} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)', color: viewerIdx >= images.length - 1 ? 'var(--gia-muted-2)' : 'white' }}>Next →</button>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>{viewerIdx + 1} / {images.length}</span>
            </div>
          </div>
        </div>
      )}
    </VisualCard>
  );
};
