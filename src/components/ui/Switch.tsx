import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  icon?: React.ReactNode;
  accentColor?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  icon,
  accentColor = '#a855f7',
  disabled = false,
}) => {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className="flex items-center gap-3 tap-feedback select-none"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <div
        className="w-8 h-4 rounded-full relative transition-all shrink-0"
        style={{
          background: checked
            ? `${accentColor}40`
            : 'rgba(255,255,255,0.1)',
        }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{
            left: checked ? '18px' : '2px',
            background: checked ? accentColor : 'var(--gia-muted-2)',
          }}
        />
      </div>
      <div className="flex-1">
        <p className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--gia-text)' }}>
          {icon && <span>{icon}</span>}
          {label}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
          {description}
        </p>
      </div>
    </div>
  );
};