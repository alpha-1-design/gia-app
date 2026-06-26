import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface OrbitalRingProps {
  size: number;
  color: string;
  speed: number;
  thickness?: number;
  opacity?: number;
  reverse?: boolean;
  delay?: number;
}

const OrbitalRing: React.FC<OrbitalRingProps> = ({ size, color, speed, thickness = 1, opacity = 0.15, reverse = false, delay = 0 }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      width: size,
      height: size,
      border: `${thickness}px solid ${color}`,
      opacity,
      left: '50%',
      top: '50%',
      marginLeft: -size / 2,
      marginTop: -size / 2,
    }}
    animate={{ rotate: [0, reverse ? -360 : 360] }}
    transition={{ duration: speed, repeat: Infinity, ease: 'linear', delay }}
  />
);

interface ParticleProps {
  index: number;
  total: number;
  radius: number;
}

const Particle: React.FC<ParticleProps> = ({ index, total, radius }) => {
  const angle = (index / total) * Math.PI * 2;
  const size = 1.5 + Math.random() * 2.5;
  const colors = ['#a855f7', '#7c3aed', '#c084fc', '#8b5cf6'];

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: colors[index % colors.length],
        boxShadow: `0 0 ${size * 3}px ${colors[index % colors.length]}`,
        left: '50%',
        top: '50%',
      }}
      animate={{
        x: [
          Math.cos(angle) * radius * 0.6,
          Math.cos(angle + 1) * radius,
          Math.cos(angle + 2) * radius * 0.8,
          Math.cos(angle) * radius * 0.6,
        ],
        y: [
          Math.sin(angle) * radius * 0.6,
          Math.sin(angle + 1) * radius,
          Math.sin(angle + 2) * radius * 0.8,
          Math.sin(angle) * radius * 0.6,
        ],
        opacity: [0.15, 0.7, 0.3, 0.15],
        scale: [0.3, 1.2, 0.6, 0.3],
      }}
      transition={{
        duration: 4 + (index % 5) * 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: index * 0.15,
      }}
    />
  );
};

export const AnimatedCharacter: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <OrbitalRing size={320} color="#a855f7" speed={25} opacity={0.08} thickness={1} />
      <OrbitalRing size={260} color="#7c3aed" speed={20} opacity={0.1} thickness={1.5} reverse delay={0.5} />
      <OrbitalRing size={200} color="#c084fc" speed={15} opacity={0.12} thickness={1} />
      <OrbitalRing size={140} color="#8b5cf6" speed={35} opacity={0.15} thickness={0.5} reverse />

      {Array.from({ length: 16 }).map((_, i) => (
        <Particle key={i} index={i} total={16} radius={80 + Math.random() * 60} />
      ))}

      <motion.div
        className="relative z-10"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(168,85,247,0.1) 35%, transparent 65%)',
            filter: 'blur(40px)',
            transform: 'scale(1.6)',
          }}
        />

        <motion.svg
          width="160"
          height="180"
          viewBox="0 0 160 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{ rotate: [0, 4, -4, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative z-10 drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 40px rgba(168,85,247,0.3))' }}
        >
          <defs>
            <radialGradient id="coreGlow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8b4fe" />
              <stop offset="30%" stopColor="#c084fc" />
              <stop offset="70%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
            <linearGradient id="eyeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e0e7ff" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="haloGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(168,85,247,0.4)" />
              <stop offset="50%" stopColor="rgba(124,58,237,0.2)" />
              <stop offset="100%" stopColor="rgba(168,85,247,0)" />
            </linearGradient>
          </defs>

          <circle cx="80" cy="75" r="65" fill="url(#coreGlow)" />

          <motion.path
            d="M80 25 C105 25 120 42 120 62 C120 80 112 92 102 102 C92 112 84 115 80 115 C76 115 68 112 58 102 C48 92 40 80 40 62 C40 42 55 25 80 25Z"
            fill="url(#bodyGrad)"
            opacity="0.95"
          />

          <ellipse cx="80" cy="60" rx="44" ry="10" stroke="rgba(168,85,247,0.2)" strokeWidth="0.5" fill="none" />

          <motion.g
            animate={{ y: [0, 0, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <ellipse cx="66" cy="58" rx="9" ry="6.5" fill="#1a1a2e" />
            <motion.ellipse cx="66" cy="58" rx="4.5" ry="4.5" fill="url(#eyeGrad)" />
            <motion.circle cx="64" cy="56" r="2" fill="white" opacity="0.6">
            </motion.circle>

            <ellipse cx="94" cy="58" rx="9" ry="6.5" fill="#1a1a2e" />
            <motion.ellipse cx="94" cy="58" rx="4.5" ry="4.5" fill="url(#eyeGrad)" />
            <motion.circle cx="92" cy="56" r="2" fill="white" opacity="0.6">
            </motion.circle>
          </motion.g>

          <motion.path
            d="M68 82 Q80 90 92 82"
            stroke="rgba(216,180,254,0.6)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            animate={{ d: ['M68 82 Q80 90 92 82', 'M68 82 Q80 94 92 82', 'M68 82 Q80 90 92 82'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.path
            d="M52 56 L42 46"
            stroke="#7c3aed"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.5"
          />
          <motion.path
            d="M108 56 L118 46"
            stroke="#7c3aed"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.5"
          />
          <motion.circle
            cx="42" cy="46" r="3.5" fill="#a855f7"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="118" cy="46" r="3.5" fill="#a855f7"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />

          <motion.ellipse
            cx="80" cy="38" rx="36" ry="8"
            stroke="url(#haloGrad)"
            strokeWidth="1.5"
            fill="none"
            animate={{ rx: [36, 42, 36], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.path
            d="M55 72 Q67 77 80 76 Q93 75 105 72"
            stroke="rgba(192,132,252,0.3)"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {[
            { x: 34, y: 34, r: 2.5 },
            { x: 126, y: 34, r: 2.5 },
            { x: 28, y: 75, r: 2 },
            { x: 132, y: 75, r: 2 },
            { x: 55, y: 20, r: 1.5 },
            { x: 105, y: 20, r: 1.5 },
            { x: 40, y: 100, r: 1.8 },
            { x: 120, y: 100, r: 1.8 },
          ].map((dot, i) => (
            <motion.circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="#c084fc"
              animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
              transition={{ duration: 2.5 + i * 0.2, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
            />
          ))}
        </motion.svg>
      </motion.div>
    </div>
  );
};
