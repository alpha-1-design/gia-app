import React, { useCallback, useEffect, useRef } from 'react';
import type { BuildStyle } from '../config/buildStyles';
import { angleForIndex, shortestDelta } from '../utils/carousel';

interface Props {
  styles: BuildStyle[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Flat, scrollable list instead of the spinning ring. */
  flat?: boolean;
}

const CARD_W = 104;
const CARD_H = 140;
const AUTO_SPEED = 10;          // degrees per second
const TAP_SLOP = 6;             // px of movement that still counts as a tap

function cardStyle(s: BuildStyle, selected: boolean): React.CSSProperties {
  return {
    border: `2px solid rgba(${s.rgb}, ${selected ? 1 : 0.55})`,
    background: `radial-gradient(circle at 50% 30%, rgba(${s.rgb}, 0.28) 0%, rgba(${s.rgb}, 0.10) 70%), #000`,
    boxShadow: selected ? `0 0 22px rgba(${s.rgb}, 0.55)` : 'none',
    color: '#fff',
  };
}

const CardFace: React.FC<{ s: BuildStyle }> = ({ s }) => (
  <span className="flex h-full flex-col items-center justify-between p-3 text-center">
    <span className="mt-2 h-8 w-8 rounded-full" style={{ background: `rgb(${s.rgb})`, boxShadow: `0 0 16px rgba(${s.rgb}, 0.7)` }} aria-hidden />
    <span>
      <span className="block text-xs font-semibold leading-tight">{s.label}</span>
      <span className="mt-1 block text-[9px] leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.tagline}</span>
    </span>
  </span>
);

/**
 * A ring of style cards in 3D. Drag to spin it, tap a card to choose it (the
 * ring turns it to the front). Spins slowly on its own until you touch it.
 * The ring is animated through refs, so spinning never re-renders React.
 */
export const StyleCarousel: React.FC<Props> = ({ styles, selectedId, onSelect, flat = false }) => {
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const dragging = useRef(false);
  const idle = useRef(true);
  const n = styles.length;
  const step = 360 / n;
  const radius = Math.round(CARD_W / 2 / Math.tan(Math.PI / n)) + 22;

  const paint = useCallback(() => {
    const ring = ringRef.current;
    if (ring) ring.style.transform = `rotateX(-12deg) rotateY(${angle.current}deg)`;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      // 1 when the card faces the viewer, -1 when it is on the far side.
      const facing = Math.cos(((angle.current + i * step) * Math.PI) / 180);
      el.style.opacity = String(0.25 + 0.75 * Math.max(0, (facing + 0.4) / 1.4));
      el.style.pointerEvents = facing > -0.1 ? 'auto' : 'none';
    });
  }, [step]);

  // Turn the chosen card to the front.
  useEffect(() => {
    if (flat) return;
    const i = Math.max(0, styles.findIndex(s => s.id === selectedId));
    target.current = angle.current + shortestDelta(angle.current, angleForIndex(i, n));
    idle.current = false;
  }, [selectedId, styles, n, flat]);

  useEffect(() => {
    if (flat) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!dragging.current) {
        if (target.current !== null) {
          const d = target.current - angle.current;
          if (Math.abs(d) < 0.2) { angle.current = target.current; target.current = null; }
          else angle.current += d * Math.min(1, dt * 8);
        } else if (idle.current) {
          angle.current += AUTO_SPEED * dt;
        }
      }
      paint();
    };
    raf = requestAnimationFrame(tick);
    const onHidden = () => { last = 0; };
    document.addEventListener('visibilitychange', onHidden);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onHidden); };
  }, [paint, flat]);

  const drag = useRef({ x: 0, moved: 0 });

  if (flat) {
    return (
      <div role="listbox" aria-label="Design style" className="flex gap-3 overflow-x-auto px-1 py-3" style={{ scrollbarWidth: 'none' }}>
        {styles.map(s => (
          <button
            key={s.id}
            role="option"
            aria-selected={s.id === selectedId}
            onClick={() => onSelect(s.id)}
            className="shrink-0 rounded-xl"
            style={{ width: CARD_W, height: CARD_H, ...cardStyle(s, s.id === selectedId) }}
          >
            <CardFace s={s} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Design style. Drag to rotate, or use the left and right arrow keys."
      tabIndex={0}
      className="relative mx-auto select-none touch-pan-y"
      style={{ height: CARD_H + 56, perspective: 900, width: '100%', overflow: 'hidden', outline: 'none' }}
      onKeyDown={e => {
        const i = Math.max(0, styles.findIndex(s => s.id === selectedId));
        if (e.key === 'ArrowRight') { e.preventDefault(); onSelect(styles[(i + 1) % n].id); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect(styles[(i - 1 + n) % n].id); }
      }}
      onPointerDown={e => {
        dragging.current = true;
        idle.current = false;
        target.current = null;
        drag.current = { x: e.clientX, moved: 0 };
      }}
      onPointerMove={e => {
        if (!dragging.current) return;
        const dx = e.clientX - drag.current.x;
        drag.current.x = e.clientX;
        drag.current.moved += Math.abs(dx);
        angle.current += dx * 0.45;
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <div
        ref={ringRef}
        className="absolute left-1/2"
        style={{ top: 24, width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, transformStyle: 'preserve-3d' }}
      >
        {styles.map((s, i) => (
          <button
            key={s.id}
            ref={el => { cardRefs.current[i] = el; }}
            type="button"
            aria-pressed={s.id === selectedId}
            aria-label={`${s.label}: ${s.tagline}`}
            onClick={() => { if (drag.current.moved < TAP_SLOP) onSelect(s.id); }}
            className="absolute inset-0 overflow-hidden rounded-xl"
            style={{ ...cardStyle(s, s.id === selectedId), transform: `rotateY(${i * step}deg) translateZ(${radius}px)` }}
            tabIndex={-1}
          >
            <CardFace s={s} />
          </button>
        ))}
      </div>
    </div>
  );
};
