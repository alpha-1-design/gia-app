import { useEffect, useState, useRef } from 'react';
import { IntentState } from '../store/useGiaStore';

export type ThinkingPhase =
  | 'gathering'
  | 'analyzing'
  | 'coding'
  | 'writing'
  | 'searching'
  | 'planning'
  | 'reasoning'
  | 'processing'
  | 'idle';

interface PhaseDef {
  label: string;
  icon: string;
  color: string;
  glowColor: string;
  speed: number; // ms per cycle
}

const PHASE_MAP: Record<ThinkingPhase, PhaseDef> = {
  gathering:  { label: 'Gathering context',     icon: '⟐', color: '#6366f1', glowColor: 'rgba(99,102,241,0.3)',  speed: 1200 },
  analyzing:  { label: 'Analyzing',              icon: '⟐', color: '#f59e0b', glowColor: 'rgba(245,158,11,0.3)', speed: 800 },
  coding:     { label: 'Coding',                 icon: '⟐', color: '#8b5cf6', glowColor: 'rgba(139,92,246,0.3)', speed: 600 },
  writing:    { label: 'Writing',                icon: '⟐', color: '#ec4899', glowColor: 'rgba(236,72,153,0.3)', speed: 700 },
  searching:  { label: 'Searching',              icon: '⟐', color: '#14b8a6', glowColor: 'rgba(20,184,166,0.3)', speed: 1000 },
  planning:   { label: 'Planning approach',      icon: '⟐', color: '#22c55e', glowColor: 'rgba(34,197,94,0.3)',  speed: 900 },
  reasoning:  { label: 'Reasoning through it',   icon: '⟐', color: '#a855f7', glowColor: 'rgba(168,85,247,0.3)', speed: 1100 },
  processing: { label: 'Processing',             icon: '⟐', color: '#3b82f6', glowColor: 'rgba(59,130,246,0.3)', speed: 500 },
  idle:       { label: 'Ready',                  icon: '',   color: '#6b7280', glowColor: 'rgba(107,114,128,0.3)', speed: 0 },
};

interface ThinkingStatusProps {
  phase: ThinkingPhase;
  intentState?: IntentState;
  onComplete?: () => void;
}

function ThinkingDot({ delay, color }: { delay: number; color: string }) {
  return (
    <div
      className="rounded-full animate-pulse"
      style={{
        width: 5,
        height: 5,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        animationDuration: '1.2s',
      }}
    />
  );
}

export function ThinkingStatus({ phase }: { phase?: ThinkingPhase }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phases: ThinkingPhase[] = [
    'gathering', 'reasoning', 'analyzing', 'planning', 'processing',
  ];

  useEffect(() => {
    setVisible(true);
    intervalRef.current = setInterval(() => {
      setCurrentPhase((prev) => (prev + 1) % phases.length);
      setPulsePhase((prev) => (prev + 1) % 12);
    }, 1800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const activePhase = phase || phases[currentPhase];
  const def = PHASE_MAP[activePhase] || PHASE_MAP.processing;

  const dots = def.label.split('').map((char, i) => (
    <span
      key={i}
      className="inline-block"
      style={{
        animation: `thinking-char 1.8s ease-in-out infinite`,
        animationDelay: `${i * 0.06}s`,
        opacity: 0.4,
      }}
    >
      {char}
    </span>
  ));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderRadius: 20,
        background: `${def.glowColor}`,
        border: `1px solid ${def.color}33`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <ThinkingDot delay={0} color={def.color} />
        <ThinkingDot delay={0.2} color={def.color} />
        <ThinkingDot delay={0.4} color={def.color} />
      </div>
      <span
        className="text-xs font-medium tracking-wide"
        style={{
          color: def.color,
          textShadow: `0 0 12px ${def.glowColor}`,
        }}
      >
        {dots}
      </span>
    </div>
  );
}

/** Full overlay for chat loading state — shows phase + glow + stop button */
export function ThinkingOverlay({
  phase,
  onStop,
}: {
  phase?: ThinkingPhase;
  onStop?: () => void;
}) {
  const [phaseIdx, setPhaseIdx] = useState(0);

  const cycle: ThinkingPhase[] = [
    'gathering', 'analyzing', 'reasoning', 'searching', 'coding', 'planning', 'writing',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIdx((prev) => (prev + 1) % cycle.length);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const activePhase = phase || cycle[phaseIdx];
  const def = PHASE_MAP[activePhase] || PHASE_MAP.processing;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, ${def.glowColor} 0%, transparent 70%)`,
      }}
    >
      <div
        className="flex items-center gap-4 px-5 py-3 rounded-2xl pointer-events-auto"
        style={{
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${def.color}44`,
          boxShadow: `0 0 40px ${def.glowColor}`,
        }}
      >
        <div className="flex gap-1.5">
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: def.color,
              animationDelay: '0s',
              animationDuration: '0.8s',
            }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: def.color,
              animationDelay: '0.15s',
              animationDuration: '0.8s',
            }}
          />
          <div
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              backgroundColor: def.color,
              animationDelay: '0.3s',
              animationDuration: '0.8s',
            }}
          />
        </div>
        <span
          className="text-sm font-semibold tracking-wider"
          style={{ color: def.color }}
        >
          {def.label}
        </span>
        <span className="text-xs opacity-40" style={{ color: def.color }}>
          · · ·
        </span>
        {onStop && (
          <button
            onClick={onStop}
            className="ml-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Stop"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill={def.color}>
              <rect width="12" height="12" rx="2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
