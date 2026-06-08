import React, { useRef, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface WaveformVisualProps {
  data: { isPlaying?: boolean; onPlay?: () => void; onStop?: () => void };
}

export const WaveformVisual: React.FC<WaveformVisualProps> = ({ data }) => {
  const { isPlaying, onPlay, onStop } = data;
  const [copied, copy] = useCopy();
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying || !barsRef.current) return;
    const bars = barsRef.current.querySelectorAll('.wave-bar');
    const anim = () => {
      bars.forEach((_, idx) => {
        const h = 10 + Math.random() * 30;
        (bars[idx] as HTMLElement).style.height = `${h}px`;
      });
      if (isPlaying) requestAnimationFrame(anim);
    };
    const raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <VisualCard title="Audio Waveform" onCopy={() => copy('')} copied={copied}>
      <div className="flex items-center gap-3">
        <button onClick={isPlaying ? onStop : onPlay} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
          {isPlaying ? <Square size={12} /> : <Play size={12} />}
        </button>
        <div ref={barsRef} className="flex-1 flex items-center gap-0.5 h-10">
          {Array.from({ length: 40 }).map((_, idx) => (
            <div key={idx} className="wave-bar rounded-full" style={{ width: '4px', height: '12px', background: isPlaying ? '#a855f7' : 'var(--gia-border)', transition: 'height 0.1s ease', opacity: isPlaying ? 0.4 + Math.random() * 0.6 : 0.3 }} />
          ))}
        </div>
      </div>
    </VisualCard>
  );
};
