import React, { useEffect, useRef } from 'react';
import { ORB_LABELS, type OrbState } from '../utils/orbState';

export type { OrbState };

interface JarvisOrbProps {
  state?: OrbState;
  size?: number;
  className?: string;
  /** Draw one still frame instead of animating (reduced motion, off-screen). */
  paused?: boolean;
}

interface Motion {
  speed: number;      // shell rotation speed
  density: number;    // share of the node pool that is visible
  pulse: number;      // breathing rate and depth
  energy: number;     // glow and node brightness
}

const STATES: Record<OrbState, Motion> = {
  idle:      { speed: 0.5, density: 0.8,  pulse: 0.9, energy: 0.8 },
  listening: { speed: 1.0, density: 0.85, pulse: 1.3, energy: 0.95 },
  thinking:  { speed: 1.7, density: 0.92, pulse: 1.9, energy: 1.05 },
  speaking:  { speed: 1.4, density: 1.0,  pulse: 2.2, energy: 1.15 },
  acting:    { speed: 2.2, density: 1.0,  pulse: 2.6, energy: 1.25 },
};

interface Node {
  theta: number;      // shell longitude (Fibonacci distributed)
  phi: number;        // shell latitude
  r: number;          // shell radius offset, in sphere radii
  drift: number;      // slow independent motion factor
  twinkle: number;    // personal "life" phase
  size: number;
  hue: 0 | 1;         // 0 cyan, 1 violet accent
  rank: number;       // 0..1, node shows when rank < density
}

const MAX_DPR = 2;
const CYAN = '0, 240, 255';
const VIOLET = '192, 132, 252';
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Evenly spread "many dots" on a Fibonacci sphere so there are no poles or
 * seams to catch the eye. Each node drifts a little on its own and the whole
 * shell breathes together.
 */
function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => {
    const off = (i + 0.5) / count;
    const phi = Math.acos(1 - 2 * off);
    const theta = i * GOLDEN_ANGLE;
    return {
      theta,
      phi,
      r: 0.92 + Math.random() * 0.16,
      drift: (0.05 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1),
      twinkle: Math.random() * Math.PI * 2,
      size: 0.7 + Math.random() * 1.4,
      hue: i % 7 === 0 ? 1 : 0,
      rank: i / count,
    };
  });
}

function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }

/**
 * A living sphere of dots. Nodes sit on a calm shell that rotates slowly and
 * moves as one breathing field; depth (back nodes smaller and dimmer, a soft
 * luminous core and a whisper of rim light) makes it read as a round glass orb.
 * On larger orbs faint lines link nearby nodes so it can also read as a
 * constellation. State changes ease between settings and never reset the nodes.
 */
const JarvisOrb: React.FC<JarvisOrbProps> = ({ state = 'idle', size = 280, className = '', paused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  stateRef.current = state;
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c = size / 2;
    const R = size * 0.24;
    const nodes = makeNodes(Math.round(size * 1.4 + 220));
    const link = size >= 120;                 // node-to-node lines on larger orbs
    const linkDist = R * 0.52;
    const linkDist2 = linkDist * linkDist;

    const cur: Motion = { ...STATES[stateRef.current] };
    let t = 0;
    let last = 0;
    let raf = 0;
    let running = false;

    interface Dot { x: number; y: number; r: number; a: number; hue: 0 | 1; x3: number; y3: number; z3: number }

    const draw = (dt: number) => {
      const target = STATES[stateRef.current];
      const k = Math.min(1, dt * 4);   // ease toward the new state
      (Object.keys(cur) as (keyof Motion)[]).forEach(key => { cur[key] = lerp(cur[key], target[key], k); });
      t += dt;

      ctx.clearRect(0, 0, size, size);

      // One shared breathing field drives glow, node life and the core rhythm.
      const breathing = 0.5 + 0.5 * Math.sin(t * (1.6 + cur.pulse * 0.9));

      // Calm halo: cyan light with a faint violet warmth at the edges.
      const glow = ctx.createRadialGradient(c, c, R * 0.3, c, c, size * 0.5);
      glow.addColorStop(0, `rgba(${CYAN}, ${(0.10 * cur.energy * (0.75 + 0.25 * breathing)).toFixed(3)})`);
      glow.addColorStop(0.55, `rgba(${CYAN}, ${(0.04 * cur.energy).toFixed(3)})`);
      glow.addColorStop(0.8, `rgba(${VIOLET}, ${(0.025 * cur.energy).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      const spin = t * 0.22 * cur.speed;
      const dots: Dot[] = [];

      for (const n of nodes) {
        if (n.rank > cur.density) continue;
        const long = n.theta + spin + n.drift * t;
        const sr = R * n.r;
        const x3 = sr * Math.sin(n.phi) * Math.cos(long);
        const z3 = sr * Math.sin(n.phi) * Math.sin(long);
        const y3 = sr * Math.cos(n.phi);
        const persp = 1 / (1 - z3 / (size * 1.7));
        const depth = (z3 / sr + 1) / 2;            // 0 back .. 1 front
        const life = 0.4 + 0.6 * breathing * (0.5 + 0.5 * Math.sin(t * 2 * cur.pulse + n.twinkle));
        const a = (0.16 + 0.72 * depth) * life * Math.min(1, cur.energy);
        const r = n.size * (size / 280 + 0.4) * (0.55 + 0.6 * depth);
        dots.push({ x: c + x3 * persp, y: c + y3 * persp, r, a, hue: n.hue, x3, y3, z3 });
      }

      const paint = (list: Dot[]) => {
        for (const d of list) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, Math.max(0.25, d.r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${d.hue === 0 ? CYAN : VIOLET}, ${d.a.toFixed(3)})`;
          ctx.fill();
        }
      };

      // Soft luminous core behind the shell so the volume reads as glass.
      const coreR = R * (0.55 + 0.18 * breathing * cur.pulse);
      const halo = ctx.createRadialGradient(c, c, 0, c, c, coreR);
      halo.addColorStop(0, `rgba(255,255,255, ${(0.06 * cur.energy).toFixed(3)})`);
      halo.addColorStop(0.45, `rgba(${CYAN}, ${(0.07 * cur.energy).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(c, c, coreR, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // Back half of the shell first, so nodes pass behind the sphere.
      paint(dots.filter(d => d.z3 < 0));

      // Faint links between nearby front nodes (constellation feel on large orbs).
      if (link) {
        ctx.lineWidth = Math.max(0.4, 0.8 * (size / 280 + 0.3));
        ctx.lineCap = 'round';
        for (let i = 0; i < dots.length; i++) {
          const p = dots[i];
          if (p.z3 < 0) continue;
          for (let j = i + 1; j < Math.min(dots.length, i + 14); j++) {
            const q = dots[j];
            if (q.z3 < 0) continue;
            const dx = p.x3 - q.x3, dy = p.y3 - q.y3, dz = p.z3 - q.z3;
            if (dx * dx + dy * dy + dz * dz > linkDist2) continue;
            const f = (p.z3 + q.z3) / (2 * R);      // 0 back .. 1 front
            ctx.strokeStyle = `rgba(${CYAN}, ${(0.04 + 0.16 * f).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      // Front half over the lines and core.
      paint(dots.filter(d => d.z3 >= 0));

      // Soft sheen on the upper-left + a subtle rim light.
      const sheen = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, 0, c - R * 0.35, c - R * 0.4, R * 0.7);
      sheen.addColorStop(0, `rgba(255,255,255, ${(0.10 * cur.energy).toFixed(3)})`);
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(c, c, R * 0.92, Math.PI * 1.1, Math.PI * 1.45);
      ctx.strokeStyle = `rgba(255,255,255, ${(0.16 * cur.energy).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.5, 1 * (size / 280 + 0.3));
      ctx.stroke();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      draw(dt);
    };
    const start = () => {
      if (running || paused) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    redrawRef.current = () => { if (!running) draw(0.016); };
    if (paused) {
      draw(0.016);
    } else {
      start();
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stop();
      redrawRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [size, paused]);

  // A paused orb still reflects state changes.
  useEffect(() => {
    if (paused) redrawRef.current?.();
  }, [state, paused]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ORB_LABELS[state]}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
};

export default JarvisOrb;