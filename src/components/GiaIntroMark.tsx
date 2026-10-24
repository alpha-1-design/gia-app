import React, { useEffect, useRef } from 'react';

interface GiaIntroMarkProps {
  phase: 'dots' | 'wordmark' | 'ready';
  onWordmark: () => void;
  onComplete: () => void;
}

interface Particle {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  delay: number;
  duration: number;
  size: number;
  bow: number;
}

const BURST_AT = 650;
const WORD_AT = 1600;
const DONE_AT = 2100;
const FONT = '600 54px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const LETTERS = ['G', 'I', 'A'];
const LETTER_GAP = 13;
const MAX_PARTICLES = 500;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

const GiaIntroMark: React.FC<GiaIntroMarkProps> = ({ phase, onWordmark, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onWordmarkRef = useRef(onWordmark);
  const onCompleteRef = useRef(onComplete);
  onWordmarkRef.current = onWordmark;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onWordmarkRef.current();
      onCompleteRef.current();
      return;
    }

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let wordCalled = false;
    let completeCalled = false;
    const start = performance.now();

    const sampleWordmark = (w: number, h: number): { x: number; y: number }[] => {
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.round(w));
      off.height = Math.max(1, Math.round(h));
      const octx = off.getContext('2d');
      if (!octx) return [];

      octx.clearRect(0, 0, off.width, off.height);
      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = FONT;

      const widths = LETTERS.map((letter) => octx.measureText(letter).width);
      const total = widths.reduce((sum, value) => sum + value, 0) + LETTER_GAP * (LETTERS.length - 1);
      let x = (off.width - total) / 2;
      const y = off.height / 2 - 4;

      LETTERS.forEach((letter, index) => {
        octx.fillText(letter, x + widths[index] / 2, y);
        x += widths[index] + LETTER_GAP;
      });

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const points: { x: number; y: number }[] = [];
      const step = 3;
      for (let py = 0; py < off.height; py += step) {
        for (let px = 0; px < off.width; px += step) {
          if (data[(py * off.width + px) * 4 + 3] > 128) {
            points.push({ x: px, y: py });
          }
        }
      }

      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      return points.slice(0, MAX_PARTICLES);
    };

    const makeParticles = (targets: { x: number; y: number }[], w: number, h: number): Particle[] => {
      const cx = w / 2;
      const cy = h / 2;
      const origins = [
        { x: cx - 24, y: cy },
        { x: cx, y: cy },
        { x: cx + 24, y: cy },
      ];
      return targets.map((target, index) => {
        const origin = origins[index % origins.length];
        const dx = target.x - cx;
        const dy = target.y - cy;
        const length = Math.hypot(dx, dy) || 1;
        return {
          sx: origin.x + (Math.random() - 0.5) * 3,
          sy: origin.y + (Math.random() - 0.5) * 3,
          tx: target.x,
          ty: target.y,
          nx: dx / length,
          ny: dy / length,
          delay: (target.x / w) * 120 + Math.random() * 60,
          duration: 620 + Math.random() * 220,
          size: 1.1 + Math.random() * 0.9,
          bow: 5 + Math.random() * 16,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width || 256;
      height = rect.height || 96;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = makeParticles(sampleWordmark(width, height), width, height);
    };

    const drawDots = (t: number) => {
      const dotAlpha = 1 - clamp01((t - BURST_AT) / 220);
      if (dotAlpha <= 0) return;

      const grow = easeOutCubic(clamp01(t / 250));
      const stretch = clamp01((t - BURST_AT) / 220);
      const pulse = 0.5 + 0.5 * Math.sin(t / 170);
      const positions = [width / 2 - 24, width / 2, width / 2 + 24];

      positions.forEach((x, index) => {
        const radius = (2.6 + pulse * 1.6 + index * 0.15) * grow;
        if (radius <= 0) return;

        ctx.beginPath();
        ctx.ellipse(x, height / 2, radius * (1 + stretch * 3), radius * (1 - stretch * 0.35), 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(0.45 + pulse * 0.5) * dotAlpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(x, height / 2, radius + 5, radius + 5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${(0.06 + pulse * 0.08) * dotAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    const drawParticles = (t: number) => {
      const fadeOut = 1 - clamp01((t - WORD_AT) / (DONE_AT - WORD_AT));
      if (fadeOut <= 0) return;

      ctx.globalAlpha = 0.9 * fadeOut;
      ctx.fillStyle = '#fff';
      ctx.beginPath();

      for (const particle of particles) {
        const local = clamp01((t - BURST_AT - particle.delay) / particle.duration);
        if (local <= 0) continue;

        const eased = easeOutCubic(local);
        const bow = Math.sin(Math.PI * local) * particle.bow;
        const x = particle.sx + (particle.tx - particle.sx) * eased + particle.nx * bow;
        const y = particle.sy + (particle.ty - particle.sy) * eased + particle.ny * bow;
        ctx.rect(x, y, particle.size, particle.size);
      }

      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, width, height);

      drawDots(t);
      if (t >= BURST_AT) drawParticles(t);

      if (t >= WORD_AT && !wordCalled) {
        wordCalled = true;
        onWordmarkRef.current();
      }
      if (t >= DONE_AT && !completeCalled) {
        completeCalled = true;
        onCompleteRef.current();
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${phase === 'ready' ? 'opacity-0' : 'opacity-100'}`}
    />
  );
};

export default GiaIntroMark;
