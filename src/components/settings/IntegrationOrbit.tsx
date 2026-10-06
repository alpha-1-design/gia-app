import React from 'react';
import { Share2 } from 'lucide-react';
import JarvisOrb from '../JarvisOrb';
import { useGiaStore } from '../../store/useGiaStore';
import { orbitPoints } from '../../utils/orbitLayout';
import { ORBIT_ITEMS, type OrbitItem } from './orbitItems';

const SIZE = 280;
const RADIUS = 108;
const BUBBLE = 44;

/**
 * Hub-and-spoke overview: GIA in the middle, every kind of connection around
 * it. Tapping one jumps to its section further down the page.
 */
export const IntegrationOrbit: React.FC<{ items?: OrbitItem[]; onOpen?: (target: string) => void }> = ({ items = ORBIT_ITEMS, onOpen }) => {
  const reduceMotion = useGiaStore(s => s.reduceMotion);
  const points = orbitPoints(items.length, SIZE, RADIUS);
  const open = (target: string) => {
    if (onOpen) onOpen(target);
    else document.getElementById(target)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col items-center" aria-label="Connections overview">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <div className="absolute rounded-full" style={{ inset: SIZE / 2 - RADIUS, border: '2px dashed rgba(148,163,184,0.35)' }} aria-hidden />
        <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)' }} aria-hidden>
          <JarvisOrb state="idle" size={96} paused={reduceMotion} />
        </div>
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => open(it.target)}
            aria-label={`Open ${it.label}`}
            title={it.label}
            className="absolute flex items-center justify-center rounded-full transition-transform duration-300 active:scale-95 hover:scale-95"
            style={{
              width: BUBBLE, height: BUBBLE, left: points[i].x - BUBBLE / 2, top: points[i].y - BUBBLE / 2,
              background: '#0a0a0f', color: it.color, border: `1px solid ${it.color}66`, boxShadow: `0 0 14px ${it.color}33`,
            }}
          >
            {it.icon}
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--gia-muted)' }}>
        <Share2 size={11} aria-hidden /> Tap a connection to set it up
      </p>
    </div>
  );
};
