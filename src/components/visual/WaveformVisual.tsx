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
    let raf = 0;
    let running = true;
    const anim = () => {
      if (!running) return;
      // Animate transform (compositor-only) instead of height (layout).
      // The bars keep a fixed height and are scaled around their center —
      // no reflow per frame.
      bars.forEach((_, idx) => {
        const s = 0.8 + Math.random() * 2.6;
        (bars[idx] as HTMLElement).style.transform = `scaleY(${s})`;
      });
      // Re-queue through the same `raf` slot so cleanup can always cancel
      // the pending frame. The previous code re-queued into a discarded id:
      // after the first frame the loop became uncancellable and ran forever
      // even after Stop (or unmount) — a permanent battery drain.
      raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    const onVisibility = () => {
      // Pause the redraw loop while the app is hidden; resume on return.
      if (document.visibilityState === 'hidden') {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(anim);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isPlaying]);

  return (
    <VisualCard title="Audio Waveform" onCopy={() => copy('')} copied={copied}>
      <div className="flex items-center gap-3">
        <button onClick={isPlaying ? onStop : onPlay} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
          {isPlaying ? <Square size={12} /> : <Play size={12} />}
        </button>
        <div ref={barsRef} className="flex-1 flex items-center gap-0.5 h-10">
          {Array.from({ length: 40 }).map((_, idx) => (
            <div
              key={idx}
              className="wave-bar rounded-full"
              style={{
                width: '4px',
                height: '12px',
                background: isPlaying ? '#a855f7' : 'var(--gia-border)',
                transformOrigin: 'center',
                // scaleY (transform) only — height transitions force layout.
                transition: 'transform 0.1s ease, background 0.15s ease',
                opacity: isPlaying ? 0.4 + (idx % 7) * 0.09 : 0.3,
              }}
            />
          ))}
        </div>
      </div>
    </VisualCard>
  );
};
