import React from 'react';
import { resolveAgentColor } from '../utils/agentIcons';

interface OrbAvatarProps {
  color?: string;
  size?: number;
  animate?: boolean;
  glow?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const OrbAvatar: React.FC<OrbAvatarProps> = ({
  color = '#a855f7',
  size = 28,
  animate = true,
  glow = true,
  icon,
  className = '',
}) => {
  const reactId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `orb-${reactId}`;

  // color may be a hex directly, or (for backwards-compat) an icon name to resolve
  let resolved = color;
  if (!HEX_RE.test(color)) {
    resolved = resolveAgentColor(color);
    if (import.meta.env.DEV && resolved === '#a855f7' && color !== 'Bot') {
      console.warn(`[OrbAvatar] unknown color/icon "${color}" — falling back to default violet`);
    }
  }

  const showIcon = !!icon;

  return (
    <div
      className={`orb-root relative shrink-0 inline-flex ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer glow halo */}
      {glow && (
        <div
          className="orb-glow absolute rounded-full"
          style={{
            inset: -size * 0.22,
            background: `radial-gradient(circle, ${resolved}40 0%, transparent 70%)`,
            filter: 'blur(5px)',
            animation: animate ? 'orb-pulse 2.8s ease-in-out infinite' : undefined,
          }}
        />
      )}

      {/* Glass orb body */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="orb-body absolute inset-0"
      >
        <defs>
          {/* Main gradient — Grok-style glowing sphere */}
          <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={resolved} stopOpacity="0.95" />
            <stop offset="45%" stopColor={resolved} stopOpacity="0.7" />
            <stop offset="100%" stopColor={resolved} stopOpacity="0.25" />
          </radialGradient>
          {/* Inner core light */}
          <radialGradient id={`${id}-core`} cx="40%" cy="35%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* Rim */}
          <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor={resolved} stopOpacity="0" />
            <stop offset="94%" stopColor={resolved} stopOpacity="0.55" />
            <stop offset="100%" stopColor={resolved} stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Soft drop shadow under orb */}
        <circle cx="16" cy="17.5" r="13" fill="#000000" opacity="0.18" />

        {/* Body */}
        <circle cx="16" cy="16" r="14" fill={`url(#${id}-body)`} />
        {/* Specular highlight */}
        <circle cx="16" cy="16" r="14" fill={`url(#${id}-core)`} />
        {/* Bright rim */}
        <circle cx="16" cy="16" r="13.5" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1" />
      </svg>

      {/* Optional icon centered in the orb */}
      {showIcon && (
        <div
          className="orb-icon absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: '#ffffff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.4))' }}
        >
          {icon}
        </div>
      )}

      <style>{`
        .orb-root { animation: orb-enter 0.42s cubic-bezier(.2,.8,.2,1) both; }
        .orb-body { transition: transform 0.28s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 50%; }
        .orb-glow { transition: opacity 0.28s ease, transform 0.28s ease; transform-origin: 50% 50%; }
        .orb-root:hover .orb-body { transform: scale(1.12); }
        .orb-root:hover .orb-glow { opacity: 1 !important; transform: scale(1.2); }
        .orb-root:hover .orb-icon { transform: scale(1.08); }
        .orb-icon { transition: transform 0.28s cubic-bezier(.2,.8,.2,1); }
        @keyframes orb-enter {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
};

export default OrbAvatar;
