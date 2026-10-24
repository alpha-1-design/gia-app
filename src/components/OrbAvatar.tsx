import React from 'react';
import { resolveAgentColor } from '../utils/agentIcons';

interface OrbAvatarProps {
  color?: string;
  size?: number;
  animate?: boolean;
  glow?: boolean;
  icon?: React.ReactNode;
  /** A soft 3D toy-bot head with rounded-square eyes. */
  face?: boolean;
  /** Offsets blink and glance so a row of agents doesn't move in lockstep. */
  seed?: string;
  className?: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 33 + value.charCodeAt(i)) | 0;
  return h;
}

function expandHex(hex: string): string {
  const h = hex.replace('#', '');
  return h.length === 3 ? h.split('').map(c => c + c).join('') : h;
}

/** Mix `hex` toward `target` by `amount` (0 = hex, 1 = target). */
function mixHex(hex: string, target: string, amount: number): string {
  const a = expandHex(hex);
  const b = expandHex(target);
  const out = [0, 2, 4].map(i => {
    const av = parseInt(a.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    return Math.round(av + (bv - av) * amount).toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`;
}

const OrbAvatar: React.FC<OrbAvatarProps> = ({
  color = '#a855f7',
  size = 28,
  animate = true,
  glow = true,
  icon,
  face = false,
  seed = '',
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

  const showIcon = !!icon && !face;
  const drift = Math.abs(hashSeed(seed || resolved)) % 40;
  const variant = Math.abs(hashSeed(seed || resolved)) % 4;

  // Body geometry — a soft rounded cube, not a sphere. The small variations
  // keep a roster from looking like one avatar copied four times.
  const bodyW = 28 + (variant === 1 ? 1 : variant === 2 ? 2 : 0);
  const bodyH = 28 + (variant === 1 ? 2 : variant === 3 ? 1 : 0);
  const bodyX = (48 - bodyW) / 2;
  const bodyY = 48 - bodyH - 7;
  const bodyR = 10;
  const eyeW = 6.4;
  const eyeH = 7.4;
  const eyeGap = 4.4;
  const eyeY = bodyY + bodyH * 0.33;
  const leftEyeX = 24 - eyeGap / 2 - eyeW;
  const rightEyeX = 24 + eyeGap / 2;
  const mouthY = bodyY + bodyH * 0.63;
  const earY = bodyY + bodyH * 0.4;
  const earH = 8.5;
  const earLeftX = bodyX - 3.4;
  const earRightX = bodyX + bodyW - 2.4;
  const antennaX = 24 + (variant === 3 ? 2 : 0);
  const antennaTipY = bodyY - 7;
  const antennaBaseY = bodyY + 1;

  const shellLight = mixHex(resolved, '#ffffff', 0.66);
  const shellBase = mixHex(resolved, '#ffffff', 0.42);
  const shellDark = mixHex(resolved, '#000000', 0.12);
  const shellEdge = mixHex(resolved, '#000000', 0.28);
  const eyeInk = '#171412';

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

      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="orb-body absolute inset-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={shellLight} />
            <stop offset="52%" stopColor={shellBase} />
            <stop offset="100%" stopColor={shellDark} />
          </linearGradient>
          <radialGradient id={`${id}-shade`} cx="58%" cy="88%" r="68%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </radialGradient>
          <radialGradient id={`${id}-eye`} cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#4a423e" />
            <stop offset="55%" stopColor="#241f1c" />
            <stop offset="100%" stopColor="#12100f" />
          </radialGradient>
          {!face && (
            <>
              <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor={resolved} stopOpacity="0.95" />
                <stop offset="45%" stopColor={resolved} stopOpacity="0.7" />
                <stop offset="100%" stopColor={resolved} stopOpacity="0.25" />
              </radialGradient>
              <radialGradient id={`${id}-core`} cx="40%" cy="35%" r="40%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
                <stop offset="72%" stopColor={resolved} stopOpacity="0" />
                <stop offset="94%" stopColor={resolved} stopOpacity="0.55" />
                <stop offset="100%" stopColor={resolved} stopOpacity="0.9" />
              </radialGradient>
            </>
          )}
        </defs>

        {face ? (
          <>
            {/* Ground shadow */}
            <ellipse cx="24" cy="44" rx="10.5" ry="2.1" fill="#000000" opacity="0.16" />

            <g
              className={animate ? 'bot-face' : undefined}
              style={animate ? { animationDelay: `-${drift / 10}s` } : undefined}
            >
              {/* Ear tabs */}
              <rect x={earLeftX} y={earY} width="5.6" height={earH} rx="2.8" fill={shellEdge} />
              <rect x={earRightX} y={earY} width="5.6" height={earH} rx="2.8" fill={shellEdge} />

              {/* Antenna */}
              <path
                d={`M ${antennaX} ${antennaBaseY} Q ${antennaX + (variant === 3 ? 2 : -1)} ${bodyY - 4} ${antennaX} ${antennaTipY}`}
                stroke={resolved}
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx={antennaX} cy={antennaTipY} r="2.2" fill={resolved} />
              <circle cx={antennaX - 0.7} cy={antennaTipY - 0.7} r="0.65" fill="#ffffff" opacity="0.75" />

              {/* Soft 3D shell */}
              <rect
                x={bodyX}
                y={bodyY}
                width={bodyW}
                height={bodyH}
                rx={bodyR}
                fill={`url(#${id}-shell)`}
              />
              <rect
                x={bodyX}
                y={bodyY}
                width={bodyW}
                height={bodyH}
                rx={bodyR}
                fill={`url(#${id}-shade)`}
              />
              <rect
                x={bodyX + 0.45}
                y={bodyY + 0.45}
                width={bodyW - 0.9}
                height={bodyH - 0.9}
                rx={bodyR - 0.45}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.34"
                strokeWidth="0.7"
              />
              <ellipse
                cx={bodyX + bodyW * 0.3}
                cy={bodyY + bodyH * 0.2}
                rx={bodyW * 0.21}
                ry={bodyH * 0.09}
                fill="#ffffff"
                opacity="0.3"
                transform={`rotate(-20 ${bodyX + bodyW * 0.3} ${bodyY + bodyH * 0.2})`}
              />

              {/* Rounded-square eyes */}
              <g className={animate ? 'bot-pupils' : undefined}>
                <g
                  className={animate ? 'bot-eyes' : undefined}
                  style={animate ? { animationDelay: `-${(drift % 17) / 5}s` } : undefined}
                >
                  <rect x={leftEyeX} y={eyeY} width={eyeW} height={eyeH} rx="2.6" fill={`url(#${id}-eye)`} />
                  <rect x={rightEyeX} y={eyeY} width={eyeW} height={eyeH} rx="2.6" fill={`url(#${id}-eye)`} />
                  <circle cx={leftEyeX + 1.7} cy={eyeY + 1.8} r="1.15" fill="#ffffff" opacity="0.92" />
                  <circle cx={rightEyeX + 1.7} cy={eyeY + 1.8} r="1.15" fill="#ffffff" opacity="0.92" />
                  <circle cx={leftEyeX + 4.9} cy={eyeY + 5.1} r="0.55" fill="#ffffff" opacity="0.42" />
                  <circle cx={rightEyeX + 4.9} cy={eyeY + 5.1} r="0.55" fill="#ffffff" opacity="0.42" />
                </g>
              </g>

              {/* Cheeks and a tiny smile */}
              <ellipse cx={bodyX + bodyW * 0.18} cy={mouthY - 0.4} rx="2.1" ry="1.15" fill={resolved} opacity="0.26" />
              <ellipse cx={bodyX + bodyW * 0.82} cy={mouthY - 0.4} rx="2.1" ry="1.15" fill={resolved} opacity="0.26" />
              <path
                d={`M ${24 - 2.3} ${mouthY} Q 24 ${mouthY + 1.4} ${24 + 2.3} ${mouthY}`}
                stroke={eyeInk}
                strokeWidth="1.15"
                fill="none"
                strokeLinecap="round"
                opacity="0.68"
              />
            </g>
          </>
        ) : (
          <>
            {/* Soft drop shadow under orb */}
            <circle cx="24" cy="26.5" r="19.5" fill="#000000" opacity="0.18" />

            {/* Body */}
            <circle cx="24" cy="24" r="21" fill={`url(#${id}-body)`} />
            {/* Specular highlight */}
            <circle cx="24" cy="24" r="21" fill={`url(#${id}-core)`} />
            {/* Bright rim */}
            <circle cx="24" cy="24" r="20.25" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" />
          </>
        )}
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
        .orb-root:hover .orb-body { transform: scale(1.08); }
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
