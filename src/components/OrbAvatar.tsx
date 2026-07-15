import React from 'react';

interface OrbAvatarProps {
  color?: string;
  size?: number;
  animate?: boolean;
  glow?: boolean;
  className?: string;
}

const OrbAvatar: React.FC<OrbAvatarProps> = ({
  color = '#a855f7',
  size = 28,
  animate = true,
  glow = true,
  className = '',
}) => {
  const id = `orb-${color.replace('#', '')}-${size}`;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer glow */}
      {glow && (
        <div
          className="absolute rounded-full"
          style={{
            inset: -size * 0.15,
            background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
            filter: 'blur(4px)',
            animation: animate ? 'orb-breathe 3s ease-in-out infinite' : undefined,
          }}
        />
      )}
      {/* Sphere */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0"
      >
        <defs>
          {/* Dark sphere gradient — Grok-style deep black core with colored rim */}
          <radialGradient id={`${id}-sphere`} cx="45%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="50%" stopColor="#0d0d1a" />
            <stop offset="100%" stopColor="#050510" />
          </radialGradient>
          {/* Colored rim light */}
          <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor={color} stopOpacity="0" />
            <stop offset="90%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </radialGradient>
          {/* Specular highlight */}
          <radialGradient id={`${id}-spec`} cx="38%" cy="32%" r="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.18" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Dark sphere body */}
        <circle cx="16" cy="16" r="15" fill={`url(#${id}-sphere)`} />
        {/* Colored rim glow */}
        <circle cx="16" cy="16" r="15" fill={`url(#${id}-rim)`} />
        {/* Subtle specular highlight */}
        <circle cx="16" cy="16" r="15" fill={`url(#${id}-spec)`} />
        {/* Thin colored border */}
        <circle cx="16" cy="16" r="14.5" fill="none" stroke={color} strokeWidth="0.5" opacity="0.25" />
      </svg>
      <style>{`
        @keyframes orb-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
};

export default OrbAvatar;
