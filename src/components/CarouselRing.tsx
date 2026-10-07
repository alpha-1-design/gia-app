import React, { useCallback, useEffect, useRef } from 'react';
import { angleForIndex, shortestDelta } from '../utils/carousel';

export interface CarouselRingItem {
  id: string;
  label: string;
  tagline?: string;
  /** RGB triplet string, e.g. "168,85,247". */
  color: string;
  icon?: React.ReactNode;
}

interface CarouselRingProps {
  items: CarouselRingItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Flat, scrollable list instead of the spinning ring. */
  flat?: boolean;
  /** Circular (orb) cards instead of rounded rectangles. */
  round?: boolean;
  width?: number;
  height?: number;
  /** Keep slowly rotating on its own while untouched. */
  autoSpin?: boolean;
  /** Keep drifting after the user stops dragging / after settling on a card. */
  keepSpinning?: boolean;
}

const DEFAULT_W = 104;
const DEFAULT_H = 140;
const AUTO_SPEED = 10;          // degrees per second
const TAP_SLOP = 6;             // px of movement that still counts as a tap

function cardStyle(it: CarouselRingItem, selected: boolean, round: boolean): React.CSSProperties {
  return {
    border: `2px solid rgba(${it.color}, ${selected ? 1 : 0.55})`,
    background: `radial-gradient(circle at 50% 30%, rgba(${it.color}, 0.28) 0%, rgba(${it.color}, 0.10) 70%), #000`,
    boxShadow: selected ? `0 0 22px rgba(${it.color}, 0.55)` : 'none',
    color: '#fff',
    borderRadius: round ? '50%' : undefined,
  };
}

const CardFace: React.FC<{ it: CarouselRingItem; round: boolean }> = ({ it, round }) => {
  if (round) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center rounded-full" style={{ padding: 10 }}>
        <span className="flex flex-1 items-center justify-center">
          {it.icon ?? <span className="block h-4 w-4 rounded-full" style={{ background: `rgb(${it.color})`, boxShadow: `0 0 16px rgba(${it.color}, 0.7)` }} />}
        </span>
        <span className="block text-[10px] font-semibold leading-tight">{it.label}</span>
      </span>
    );
  }
  return (
    <span className="flex h-full flex-col items-center justify-between p-3 text-center">
      <span className="mt-2 h-8 w-8 rounded-full" style={{ background: `rgb(${it.color})`, boxShadow: `0 0 16px rgba(${it.color}, 0.7)` }} aria-hidden />
      <span>
        <span className="block text-xs font-semibold leading-tight">{it.label}</span>
        {it.tagline && <span className="mt-1 block text-[9px] leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>{it.tagline}</span>}
      </span>
    </span>
  );
};

/**
 * A ring of cards in 3D. Drag to spin it, tap a card to fire onSelect (the
 * ring turns it to the front). Spins slowly on its own until you touch it.
 * The ring is animated through refs, so spinning never re-renders React.
 */
export const CarouselRing: React.FC<CarouselRingProps> = ({
  items, selectedId, onSelect, flat = false, round = false,
  width = DEFAULT_W, height = DEFAULT_H, autoSpin = true, keepSpinning = false,
}) => {
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const dragging = useRef(false);
  const idle = useRef(true);
  const n = items.length;
  const step = 360 / n;
  const radius = Math.round(width / 2 / Math.tan(Math.PI / n)) + 22;

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

  // Turn the chosen card to the front. No selection (e.g. a non-persistent
  // shortcut ring) means we never leave idle, so it can keep spinning.
  useEffect(() => {
    if (flat || !selectedId) return;
    const i = Math.max(0, items.findIndex(s => s.id === selectedId));
    target.current = angle.current + shortestDelta(angle.current, angleForIndex(i, n));
    idle.current = false;
  }, [selectedId, items, n, flat]);

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
          if (Math.abs(d) < 0.2) { angle.current = target.current; target.current = null; if (keepSpinning) idle.current = true; }
          else angle.current += d * Math.min(1, dt * 8);
        } else if (idle.current && autoSpin && n > 0) {
          angle.current += AUTO_SPEED * dt;
        }
      }
      paint();
    };
    raf = requestAnimationFrame(tick);
    const onHidden = () => { last = 0; };
    document.addEventListener('visibilitychange', onHidden);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onHidden); };
  }, [paint, flat, autoSpin, n, keepSpinning]);

  const drag = useRef({ x: 0, moved: 0 });

  if (flat) {
    return (
      <div role="listbox" aria-label="Options" className="flex gap-3 overflow-x-auto px-1 py-3" style={{ scrollbarWidth: 'none' }}>
        {items.map(it => (
          <button
            key={it.id}
            role="option"
            aria-selected={it.id === selectedId}
            onClick={() => onSelect(it.id)}
            className="shrink-0"
            style={{ width, height, ...cardStyle(it, it.id === selectedId, round) }}
          >
            <CardFace it={it} round={round} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Options. Drag to rotate, or use the left and right arrow keys."
      tabIndex={0}
      className="relative mx-auto select-none touch-pan-y"
      style={{ height: height + 56, perspective: 900, width: '100%', overflow: 'hidden', outline: 'none' }}
      onKeyDown={e => {
        const i = Math.max(0, items.findIndex(s => s.id === selectedId));
        if (e.key === 'ArrowRight') { e.preventDefault(); onSelect(items[(i + 1) % n].id); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect(items[(i - 1 + n) % n].id); }
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
      onPointerUp={() => { dragging.current = false; if (keepSpinning) idle.current = true; }}
      onPointerCancel={() => { dragging.current = false; if (keepSpinning) idle.current = true; }}
      onPointerLeave={() => { dragging.current = false; if (keepSpinning) idle.current = true; }}
    >
      <div
        ref={ringRef}
        className="absolute left-1/2"
        style={{ top: 24, width, height, marginLeft: -width / 2, transformStyle: 'preserve-3d' }}
      >
        {items.map((it, i) => (
          <button
            key={it.id}
            ref={el => { cardRefs.current[i] = el; }}
            type="button"
            aria-pressed={it.id === selectedId}
            aria-label={it.tagline ? `${it.label}: ${it.tagline}` : it.label}
            onClick={() => { if (drag.current.moved < TAP_SLOP) onSelect(it.id); }}
            className="absolute inset-0 overflow-hidden"
            style={{ ...cardStyle(it, it.id === selectedId, round), transform: `rotateY(${i * step}deg) translateZ(${radius}px)` }}
            tabIndex={-1}
          >
            <CardFace it={it} round={round} />
          </button>
        ))}
      </div>
    </div>
  );
};