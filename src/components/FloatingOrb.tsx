import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue } from 'motion/react';
import JarvisOrb from './JarvisOrb';
import { TOOL_META } from './WorkLog';
import { useGiaStore } from '../store/useGiaStore';
import { useOrbState } from '../hooks/useOrbState';
import { ORB_LABELS, type OrbState } from '../utils/orbState';

const SIZE = 96;
const MARGIN = 6;
const POS_KEY = 'gia-floating-orb-pos';
const TOP_CLEARANCE = 56;      // header
const BOTTOM_CLEARANCE = 150;  // composer + nav

interface Pos { x: number; y: number }

function clampPos(p: Pos): Pos {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, w - SIZE - MARGIN)),
    y: Math.min(Math.max(TOP_CLEARANCE, p.y), Math.max(TOP_CLEARANCE, h - SIZE - BOTTOM_CLEARANCE)),
  };
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Pos;
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return clampPos(p);
    }
  } catch { /* fall through to the default */ }
  return clampPos({ x: window.innerWidth - SIZE - MARGIN, y: window.innerHeight - SIZE - BOTTOM_CLEARANCE - 20 });
}

function statusText(state: OrbState, currentTool: string | null): string {
  if (state === 'acting' && currentTool) return TOOL_META[currentTool]?.label ?? currentTool.replace(/_/g, ' ');
  return ORB_LABELS[state].replace(/^GIA is /, '').replace(/^./, c => c.toUpperCase());
}

/**
 * Always-available draggable orb. It mirrors what GIA is doing right now
 * (listening, thinking, speaking, running a tool) and snaps to the nearest
 * screen edge when released. Tap it to jump to chat or show/hide its label.
 */
const FloatingOrb: React.FC = () => {
  const enabled = useGiaStore(s => s.showFloatingOrb);
  const reduceMotion = useGiaStore(s => s.reduceMotion);
  const currentTool = useGiaStore(s => s.currentTool);
  const state = useOrbState();

  // Position lives in motion values so dragging never re-renders React.
  const start = useMemo(loadPos, []);
  const x = useMotionValue(start.x);
  const y = useMotionValue(start.y);
  const [side, setSide] = useState<'left' | 'right'>(start.x + SIZE / 2 > window.innerWidth / 2 ? 'right' : 'left');
  const [pinnedLabel, setPinnedLabel] = useState(false);
  const draggedRef = useRef(false);

  // Keep the orb on screen when the window changes (rotation, keyboard, split view).
  useEffect(() => {
    const onResize = () => {
      const p = clampPos({ x: x.get(), y: y.get() });
      x.set(p.x);
      y.set(p.y);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [x, y]);

  const label = useMemo(() => statusText(state, currentTool), [state, currentTool]);
  const showLabel = state !== 'idle' || pinnedLabel;

  if (!enabled) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.08}
      dragConstraints={{
        left: MARGIN,
        right: window.innerWidth - SIZE - MARGIN,
        top: TOP_CLEARANCE,
        bottom: window.innerHeight - SIZE - BOTTOM_CLEARANCE,
      }}
      onDragStart={() => { draggedRef.current = true; }}
      onDragEnd={() => {
        const raw = clampPos({ x: x.get(), y: y.get() });
        const toRight = raw.x + SIZE / 2 > window.innerWidth / 2;
        const snapped = { x: toRight ? window.innerWidth - SIZE - MARGIN : MARGIN, y: raw.y };
        setSide(toRight ? 'right' : 'left');
        animate(x, snapped.x, { duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' });
        animate(y, snapped.y, { duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' });
        try { localStorage.setItem(POS_KEY, JSON.stringify(snapped)); } catch { /* storage blocked */ }
        // The click that follows a drag must not count as a tap.
        setTimeout(() => { draggedRef.current = false; }, 0);
      }}
      className="fixed left-0 top-0 z-40 select-none touch-none"
      style={{ x, y, width: SIZE, height: SIZE }}
    >
      <button
        type="button"
        aria-label={`${ORB_LABELS[state]}. Tap for chat, drag to move.`}
        onClick={() => {
          if (draggedRef.current) return;
          const st = useGiaStore.getState();
          if (st.currentModule !== 'chat') st.setModule('chat');
          else setPinnedLabel(v => !v);
        }}
        className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        style={{ width: SIZE, height: SIZE, background: 'transparent' }}
      >
        <JarvisOrb state={state} size={SIZE} paused={reduceMotion} />
      </button>

      <AnimatePresence>
        {showLabel && (
          <motion.div
            key="label"
            initial={{ opacity: 0, x: side === 'right' ? 6 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            role="status"
            aria-live="polite"
            className="absolute top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap pointer-events-none"
            style={{
              [side === 'right' ? 'right' : 'left']: SIZE - 6,
              background: 'rgba(8, 14, 28, 0.82)',
              border: '1px solid rgba(0, 240, 255, 0.28)',
              color: '#a5f3fc',
              backdropFilter: 'blur(10px)',
              maxWidth: Math.min(220, window.innerWidth - SIZE - 24),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(FloatingOrb);
