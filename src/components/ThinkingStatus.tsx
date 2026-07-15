import { useEffect, useState, useRef } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import GiaIcon from './GiaIcon';
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
  speed: number;
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

const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  web_search:       { label: 'Searching the web',        color: '#14b8a6' },
  read_url:         { label: 'Reading page content',     color: '#14b8a6' },
  browser_navigate: { label: 'Navigating browser',       color: '#14b8a6' },
  page_info:        { label: 'Fetching page info',       color: '#14b8a6' },
  web_scrape:       { label: 'Scraping web page',        color: '#14b8a6' },
  terminal_run:     { label: 'Running code',             color: '#8b5cf6' },
  terminal_status:  { label: 'Checking terminal',        color: '#8b5cf6' },
  terminal_kill:    { label: 'Stopping process',         color: '#8b5cf6' },
  filesystem_read:  { label: 'Reading files',            color: '#6366f1' },
  filesystem_write: { label: 'Writing files',            color: '#6366f1' },
  list_files:       { label: 'Listing directory',        color: '#6366f1' },
  file_search:      { label: 'Searching files',          color: '#6366f1' },
  file_get:         { label: 'Reading file',             color: '#6366f1' },
  file_list:        { label: 'Listing files',            color: '#6366f1' },
  image_generation: { label: 'Generating image',         color: '#ec4899' },
  zip_project:      { label: 'Creating archive',         color: '#f59e0b' },
  http_request:     { label: 'Making HTTP request',      color: '#3b82f6' },
  emoji_search:     { label: 'Searching emoji',          color: '#f59e0b' },
  brain_boost:      { label: 'Enhancing context',        color: '#a855f7' },
  delegate_task:    { label: 'Delegating sub-task',      color: '#22c55e' },
  request_clarification: { label: 'Requesting clarification', color: '#f59e0b' },
  code_execute:     { label: 'Executing code',           color: '#8b5cf6' },
  python_execute:   { label: 'Running Python',           color: '#8b5cf6' },
  build_project:    { label: 'Building project',         color: '#f97316' },
  neura_query:      { label: 'Querying Neura knowledge', color: '#a78bfa' },
  neura_related:    { label: 'Tracing Neura connections', color: '#818cf8' },
  neura_stats:      { label: 'Reading Neura stats',      color: '#c084fc' },
  save_memory:      { label: 'Saving to memory',         color: '#a855f7' },
  forget_memory:    { label: 'Clearing memory',          color: '#a855f7' },
  note_create:      { label: 'Creating note',            color: '#f59e0b' },
  note_read:        { label: 'Reading note',             color: '#f59e0b' },
  note_update:      { label: 'Updating note',            color: '#f59e0b' },
  note_delete:      { label: 'Deleting note',            color: '#f59e0b' },
  task_create:      { label: 'Creating task',            color: '#22c55e' },
  task_read:        { label: 'Reading task',             color: '#22c55e' },
  task_update:      { label: 'Updating task',            color: '#22c55e' },
  task_delete:      { label: 'Deleting task',            color: '#22c55e' },
  generate_file:    { label: 'Generating file',          color: '#6366f1' },
  edit_document:    { label: 'Editing document',         color: '#6366f1' },
  download_url:     { label: 'Downloading file',         color: '#6366f1' },
  download_file:    { label: 'Downloading file',         color: '#6366f1' },
  browse_web:       { label: 'Browsing the web',         color: '#14b8a6' },
  read_document:    { label: 'Reading document',         color: '#14b8a6' },
  data_analysis:    { label: 'Analyzing data',           color: '#3b82f6' },
  local_search:     { label: 'Searching locally',        color: '#3b82f6' },
  screenshot:       { label: 'Taking screenshot',        color: '#ec4899' },
  share_content:    { label: 'Sharing content',          color: '#22c55e' },
  create_pdf:       { label: 'Creating PDF',             color: '#f97316' },
  sandbox_exec:     { label: 'Running in sandbox',       color: '#8b5cf6' },
  sandbox_install:  { label: 'Installing in sandbox',    color: '#8b5cf6' },
  sandbox_clone:    { label: 'Cloning repo',             color: '#8b5cf6' },
};

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

export function ThinkingStatus({ phase, toolName, onTap }: { phase?: ThinkingPhase; toolName?: string | null; onTap?: () => void }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extThinking = useGiaStore(s => s.extThinking);
  const phases: ThinkingPhase[] = [
    'gathering', 'reasoning', 'analyzing', 'planning', 'processing',
  ];

  useEffect(() => {
    setVisible(true);
    intervalRef.current = setInterval(() => {
      setCurrentPhase((prev) => (prev + 1) % phases.length);
    }, 1800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phases.length]);

  const sharedStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 14px',
    borderRadius: 20,
    cursor: onTap ? 'pointer' : 'default',
    transition: 'all 0.25s ease',
  };

  const renderIcon = (color: string) => {
    if (extThinking) {
      return <GiaIcon size={16} animate color={color} />;
    }
    return (
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <ThinkingDot delay={0} color={color} />
        <ThinkingDot delay={0.2} color={color} />
        <ThinkingDot delay={0.4} color={color} />
      </div>
    );
  };

  if (toolName && TOOL_LABELS[toolName]) {
    const tl = TOOL_LABELS[toolName];
    return (
      <div
        onClick={onTap}
        style={{
          ...sharedStyle,
          background: `${tl.color}22`,
          border: `1px solid ${tl.color}44`,
        }}
      >
        {renderIcon(tl.color)}
        <span className="text-xs font-medium tracking-wide" style={{ color: tl.color }}>
          {tl.label}
        </span>
      </div>
    );
  }

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
      onClick={onTap}
      style={{
        ...sharedStyle,
        background: `${def.glowColor}`,
        border: `1px solid ${def.color}33`,
        opacity: visible ? 1 : 0,
      }}
    >
      {renderIcon(def.color)}
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
  toolName,
  onStop,
}: {
  phase?: ThinkingPhase;
  toolName?: string | null;
  onStop?: () => void;
}) {
  const extThinking = useGiaStore(s => s.extThinking);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const cycle: ThinkingPhase[] = [
    'gathering', 'analyzing', 'reasoning', 'searching', 'coding', 'planning', 'writing',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIdx((prev) => (prev + 1) % cycle.length);
    }, 1200);
    return () => clearInterval(timer);
  }, [cycle.length]);

  if (toolName && TOOL_LABELS[toolName]) {
    const tl = TOOL_LABELS[toolName];
    return (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${tl.color}22 0%, transparent 70%)`,
        }}
      >
        <div
          className="flex items-center gap-4 px-5 py-3 rounded-2xl pointer-events-auto"
          style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${tl.color}44`,
            boxShadow: `0 0 40px ${tl.color}33`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {extThinking ? (
              <GiaIcon size={20} animate color={tl.color} speed={1.2} />
            ) : (
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: tl.color, animationDuration: '0.8s' }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: tl.color, animationDelay: '0.15s', animationDuration: '0.8s' }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: tl.color, animationDelay: '0.3s', animationDuration: '0.8s' }} />
              </div>
            )}
          </div>
          <span className="text-sm font-semibold tracking-wider" style={{ color: tl.color }}>
            {tl.label}
          </span>
          <span className="text-xs opacity-40" style={{ color: tl.color }}>· · ·</span>
          {onStop && (
            <button onClick={onStop} className="ml-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Stop">
              <svg width="12" height="12" viewBox="0 0 12 12" fill={tl.color}><rect width="12" height="12" rx="2" /></svg>
            </button>
          )}
        </div>
      </div>
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {extThinking ? (
            <GiaIcon size={22} animate color={def.color} speed={1.2} />
          ) : (
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: def.color, animationDuration: '0.8s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: def.color, animationDelay: '0.15s', animationDuration: '0.8s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: def.color, animationDelay: '0.3s', animationDuration: '0.8s' }} />
            </div>
          )}
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
