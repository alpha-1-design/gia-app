import React from 'react';

interface GiaIconProps {
  size?: number;
  animate?: boolean;
  color?: string;
  speed?: number;
  className?: string;
}

const GiaIcon: React.FC<GiaIconProps> = ({
  size = 14,
  animate = true,
  color = 'currentColor',
  speed = 1,
  className = '',
}) => {
  const spinCw = animate
    ? { animation: `gia-spin-cw ${3 / speed}s linear infinite` }
    : {};
  const spinCcw = animate
    ? { animation: `gia-spin-ccw ${2.5 / speed}s linear infinite` }
    : {};
  const breathe = animate
    ? { animation: `gia-breathe ${2 / speed}s ease-in-out infinite` }
    : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...spinCw }}
      aria-label="GIA"
    >
      {/* Outer star — clockwise */}
      <g style={{ ...spinCw, transformOrigin: '12px 12px' }}>
        <path
          d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
          fill={color}
          opacity="0.25"
        />
      </g>
      {/* Dashed ring — counter-clockwise */}
      <g style={{ ...spinCcw, transformOrigin: '12px 12px' }}>
        <circle
          cx="12" cy="12" r="8"
          stroke={color}
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.4"
          fill="none"
        />
      </g>
      {/* Center dot — breathing */}
      <circle
        cx="12" cy="12" r="2.5"
        fill={color}
        opacity="0.9"
        style={breathe}
      />
    </svg>
  );
};

export default GiaIcon;
