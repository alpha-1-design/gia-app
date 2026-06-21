import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface Slide {
  title?: string;
  content: string;
  background?: string;
}

interface SlidesData {
  title?: string;
  slides: Slide[];
}

export const SlidesVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as unknown as SlidesData;
  const slides = d.slides || [];
  const title = d.title;
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();

  const copyData = useCallback(() => copy(JSON.stringify(d, null, 2)), [d, copy]);

  if (!slides.length) return <div className="p-4 text-[11px]" style={{ color: 'var(--gia-muted-2)' }}>No slides</div>;

  const slide = slides[current];

  return (
    <VisualCard title={title || 'Presentation'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium" style={{ color: 'var(--gia-muted-2)' }}>
          {current + 1} / {slides.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrent(i => Math.max(0, i - 1))}
            disabled={current === 0}
            className="p-1 rounded disabled:opacity-30"
            style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCurrent(i => Math.min(slides.length - 1, i + 1))}
            disabled={current === slides.length - 1}
            className="p-1 rounded disabled:opacity-30"
            style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        className="rounded-xl p-6 min-h-[250px] flex flex-col"
        style={{
          background: slide.background || 'linear-gradient(135deg, #0d0d14, #1a1a2e)',
          color: '#f0f0f0',
        }}
      >
        {slide.title && (
          <h2 className="text-lg font-bold mb-3" style={{ color: '#fff' }}>
            {slide.title}
          </h2>
        )}
        <div
          className="flex-1 text-[13px] leading-relaxed whitespace-pre-wrap"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          {slide.content}
        </div>
      </div>

      {/* Slide thumbnails */}
      {slides.length > 1 && (
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="shrink-0 w-12 h-8 rounded-md border transition-opacity"
              style={{
                borderColor: i === current ? 'var(--gia-accent)' : 'var(--gia-border)',
                opacity: i === current ? 1 : 0.5,
                background: s.background || '#0d0d14',
              }}
              title={s.title || `Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </VisualCard>
  );
};
