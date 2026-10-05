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
  speed: number;      // particle orbit speed multiplier
  density: number;    // share of the particle pool that is visible
  pulse: number;      // core pulse rate and depth
  ringSpeed: number;
  energy: number;     // brightness of core and glow
}

const STATES: Record<OrbState, Motion> = {
  idle:      { speed: 0.6, density: 0.55, pulse: 0.8, ringSpeed: 0.7, energy: 0.8 },
  listening: { speed: 1.2, density: 0.8,  pulse: 1.3, ringSpeed: 1.3, energy: 1.0 },
  thinking:  { speed: 2.0, density: 0.9,  pulse: 1.7, ringSpeed: 2.2, energy: 1.1 },
  speaking:  { speed: 1.5, density: 1.0,  pulse: 2.0, ringSpeed: 1.6, energy: 1.2 },
  acting:    { speed: 2.4, density: 1.0,  pulse: 2.3, ringSpeed: 2.8, energy: 1.3 },
};

interface Particle {
  theta: number;      // longitude
  phi: number;        // latitude
  r: number;          // orbit radius, in sphere radii
  w: number;          // angular velocity (rad/s)
  size: number;
  twinkle: number;
  hue: 0 | 1;         // 0 cyan, 1 violet
  rank: number;       // 0..1, particle shows when rank < density
}

const MAX_DPR = 2;
const CYAN = '0, 240, 255';
const VIOLET = '192, 132, 252';

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    theta: Math.random() * Math.PI * 2,
    phi: Math.acos(2 * Math.random() - 1),
    r: 1.1 + Math.random() * 1.15,
    w: (0.15 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
    size: 0.5 + Math.random() * 1.5,
    twinkle: Math.random() * Math.PI * 2,
    hue: Math.random() > 0.55 ? 0 : 1,
    rank: i / count,
  }));
}

function lerp(a: number, b: number, k: number) { return a + (b - a) * k; }

/**
 * Glass sphere with a bright cyan core, tilted rings and an orbiting particle
 * field. Particles behind the sphere are drawn under it and those in front are
 * drawn over it, so it reads as 3D. State changes ease between settings and
 * never reset the particles.
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
    // Rings reach 2.2 R and particles ~2.25 R; keep both inside the canvas.
    const R = size * 0.2;
    // Small orbs need far fewer particles; they would just be a smear.
    const particles = makeParticles(Math.max(24, Math.round(150 * Math.min(1, size / 280) + 20)));

    const cur: Motion = { ...STATES[stateRef.current] };
    let t = 0;
    let last = 0;
    let raf = 0;
    let running = false;

    const draw = (dt: number) => {
      const target = STATES[stateRef.current];
      const k = Math.min(1, dt * 4);   // ease toward the new state
      (Object.keys(cur) as (keyof Motion)[]).forEach(key => { cur[key] = lerp(cur[key], target[key], k); });
      t += dt;

      ctx.clearRect(0, 0, size, size);

      // Outer glow
      const glow = ctx.createRadialGradient(c, c, R * 0.4, c, c, size * 0.5);
      glow.addColorStop(0, `rgba(${CYAN}, ${0.16 * cur.energy})`);
      glow.addColorStop(0.55, `rgba(${VIOLET}, ${0.07 * cur.energy})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Particles: rotate around the vertical axis, then project.
      const spin = t * 0.25 * cur.speed;
      const front: { x: number; y: number; a: number; s: number; hue: 0 | 1 }[] = [];
      const back: typeof front = [];
      for (const p of particles) {
        if (p.rank > cur.density) continue;
        p.theta += p.w * dt * cur.speed;
        const th = p.theta + spin;
        const rr = R * p.r;
        const x = rr * Math.sin(p.phi) * Math.cos(th);
        const z = rr * Math.sin(p.phi) * Math.sin(th);
        const y = rr * Math.cos(p.phi);
        const persp = 1 / (1 - z / (size * 1.6));
        const depth = (z / rr + 1) / 2;   // 0 back .. 1 front
        const a = (0.25 + 0.65 * depth) * (0.6 + 0.4 * Math.sin(t * 2 + p.twinkle));
        const dot = { x: c + x * persp, y: c + y * persp, a: a * Math.min(1, cur.energy), s: p.size * (0.6 + 0.6 * depth) * (size / 280 + 0.35), hue: p.hue };
        (z >= 0 ? front : back).push(dot);
      }
      const paint = (dots: typeof front) => {
        for (const d of dots) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${d.hue === 0 ? CYAN : VIOLET}, ${d.a})`;
          ctx.fill();
        }
      };
      paint(back);

      // Rings
      for (let i = 0; i < 3; i++) {
        const rr = R * (1.4 + i * 0.4);
        const rot = t * cur.ringSpeed * (0.35 + i * 0.22) * (i % 2 === 0 ? 1 : -1);
        const tilt = 0.4 + i * 0.2;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * Math.cos(tilt), 0, 0, Math.PI * 2);
        ctx.strokeStyle = i === 1 ? `rgba(${CYAN}, 0.5)` : `rgba(${VIOLET}, ${0.4 - i * 0.07})`;
        ctx.lineWidth = Math.max(0.75, (1.5 - i * 0.3) * (size / 280 + 0.4));
        ctx.stroke();
        if (i === 0) {
          ctx.setLineDash([6, 10]);
          ctx.strokeStyle = 'rgba(128, 255, 255, 0.3)';
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // Glass body
      const glass = ctx.createRadialGradient(c - R * 0.3, c - R * 0.35, 0, c, c, R);
      glass.addColorStop(0, 'rgba(180, 240, 255, 0.26)');
      glass.addColorStop(0.45, 'rgba(100, 180, 255, 0.12)');
      glass.addColorStop(0.85, 'rgba(40, 80, 160, 0.09)');
      glass.addColorStop(1, 'rgba(20, 40, 80, 0.2)');
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.45)';
      ctx.lineWidth = Math.max(0.75, 1.5 * (size / 280 + 0.3));
      ctx.stroke();

      // Core
      const beat = 1 + Math.sin(t * 3.2 * cur.pulse) * 0.07 * cur.pulse;
      const cr = R * 0.4 * beat;
      const halo = ctx.createRadialGradient(c, c, 0, c, c, cr * 2.3);
      halo.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, 0.9 * cur.energy)})`);
      halo.addColorStop(0.2, `rgba(${CYAN}, ${Math.min(1, 0.85 * cur.energy)})`);
      halo.addColorStop(0.55, `rgba(0, 180, 255, ${0.35 * cur.energy})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(c, c, cr * 2.3, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      // Highlight
      ctx.beginPath();
      ctx.arc(c - R * 0.28, c - R * 0.32, R * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fill();

      paint(front);
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
