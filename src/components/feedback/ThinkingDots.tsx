import React from 'react';
import { clsx } from 'clsx';

interface ThinkingDotsProps {
  visible: boolean;
  color?: string;
  size?: number;
}

const ThinkingDots: React.FC<ThinkingDotsProps> = ({
  visible,
  color = 'bg-indigo-400',
  size = 8,
}) => {
  if (!visible) return null;

  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={clsx('rounded-full animate-bounce', color)}
          style={{
            width: size,
            height: size,
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.8s',
          }}
        />
      ))}
    </span>
  );
};

export default ThinkingDots;
