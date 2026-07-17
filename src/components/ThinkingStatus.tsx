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
  gathering:  { label: 'Sniffing around',            icon: '⟐', color: '#6366f1', glowColor: 'rgba(99,102,241,0.3)',  speed: 1200 },
  analyzing:  { label: 'Squinting at it',             icon: '⟐', color: '#f59e0b', glowColor: 'rgba(245,158,11,0.3)', speed: 800 },
  coding:     { label: 'Cooking',                     icon: '⟐', color: '#8b5cf6', glowColor: 'rgba(139,92,246,0.3)', speed: 600 },
  writing:    { label: 'Spilling ink',                icon: '⟐', color: '#ec4899', glowColor: 'rgba(236,72,153,0.3)', speed: 700 },
  searching:  { label: 'Googling stuff',              icon: '⟐', color: '#14b8a6', glowColor: 'rgba(20,184,166,0.3)', speed: 1000 },
  planning:   { label: 'Drawing maps',                icon: '⟐', color: '#22c55e', glowColor: 'rgba(34,197,94,0.3)',  speed: 900 },
  reasoning:  { label: 'Big brain time',              icon: '⟐', color: '#a855f7', glowColor: 'rgba(168,85,247,0.3)', speed: 1100 },
  processing: { label: 'Crunching bytes',             icon: '⟐', color: '#3b82f6', glowColor: 'rgba(59,130,246,0.3)', speed: 500 },
  idle:       { label: 'Ready',                       icon: '',   color: '#6b7280', glowColor: 'rgba(107,114,128,0.3)', speed: 0 },
};

const THINKING_EXTRAS = [
  'Doing stuff or something',
  'I think I know what I\'m doing',
  'Pretending to know things',
  'Following the breadcrumbs',
  'Thinking hard about thinking',
  'Loading... just kidding, working',
  'Convincing the electrons',
  'Asking the right questions',
  'Making it up as I go',
  'Trusting the process',
  'Vibing and coding',
  'One sec, almost there',
  'Consulting the void',
  'Doing my best impression of useful',
  'Winging it (successfully)',
];

const BUILD_PHASE_MAP: Partial<Record<ThinkingPhase, PhaseDef>> = {
  planning:   { label: 'Architecting the vibes',     icon: '⟐', color: '#f97316', glowColor: 'rgba(249,115,22,0.35)', speed: 900 },
  gathering:  { label: 'Scaffolding things',          icon: '⟐', color: '#fb923c', glowColor: 'rgba(251,146,60,0.35)',  speed: 800 },
  coding:     { label: 'Banging out code',            icon: '⟐', color: '#f97316', glowColor: 'rgba(249,115,22,0.35)', speed: 600 },
  processing: { label: 'Wrestling bugs',              icon: '⟐', color: '#ea580c', glowColor: 'rgba(234,88,12,0.35)',  speed: 700 },
  reasoning:  { label: 'Wiring it up',                icon: '⟐', color: '#c2410c', glowColor: 'rgba(194,65,12,0.35)',  speed: 800 },
};

const BUILD_EXTRAS = [
  'Shipping it',
  'No pressure, just building an app',
  'Crafting digital excellence',
  'This is fine',
  'Building something cool',
  'Hopefully this works',
  'Making it rain code',
  'Engineering (kind of)',
  'Trust me, I\'m an AI',
  'Hack hack hack',
  'Turning caffeine into code (metaphorically)',
  'Building the future (or at least a webpage)',
  'Deploying good vibes',
  'Compiling happiness',
  '10x developer moment',
];

const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  web_search:       { label: 'Searching the web',        color: '#14b8a6' },
  read_url:         { label: 'Reading the tea leaves',   color: '#14b8a6' },
  browser_navigate: { label: 'Surfing the web',          color: '#14b8a6' },
  page_info:        { label: 'Peeking at metadata',      color: '#14b8a6' },
  web_scrape:       { label: 'Scraping deliciously',     color: '#14b8a6' },
  terminal_run:     { label: 'Running wild',             color: '#8b5cf6' },
  terminal_status:  { label: 'Checking the pulse',       color: '#8b5cf6' },
  terminal_kill:    { label: 'Stopping the chaos',       color: '#8b5cf6' },
  filesystem_read:  { label: 'Peeking at files',         color: '#6366f1' },
  filesystem_write: { label: 'Slapping down code',       color: '#6366f1' },
  list_files:       { label: 'Rummaging through files',  color: '#6366f1' },
  file_search:      { label: 'Hunting files',            color: '#6366f1' },
  file_get:         { label: 'Grabbing a file',          color: '#6366f1' },
  file_list:        { label: 'Counting files',           color: '#6366f1' },
  image_generation: { label: 'Painting pixels',          color: '#ec4899' },
  zip_project:      { label: 'Packing it up',            color: '#f59e0b' },
  http_request:     { label: 'Talking to servers',       color: '#3b82f6' },
  emoji_search:     { label: 'Finding the vibe',         color: '#f59e0b' },
  brain_boost:      { label: 'Boosting brainpower',      color: '#a855f7' },
  delegate_task:    { label: 'Summoning a sub-agent',    color: '#22c55e' },
  request_clarification: { label: 'Asking nicely',       color: '#f59e0b' },
  code_execute:     { label: 'Launching code',           color: '#8b5cf6' },
  python_execute:   { label: 'Snakes go brrr',           color: '#8b5cf6' },
  build_project:    { label: 'Constructing things',      color: '#f97316' },
  neura_query:      { label: 'Consulting Neura',         color: '#a78bfa' },
  neura_related:    { label: 'Tracing connections',      color: '#818cf8' },
  neura_stats:      { label: 'Reading the matrix',       color: '#c084fc' },
  save_memory:      { label: 'Remembering stuff',        color: '#a855f7' },
  forget_memory:    { label: 'Forgetting things',        color: '#a855f7' },
  note_create:      { label: 'Taking notes',             color: '#f59e0b' },
  note_read:        { label: 'Reading notes',            color: '#f59e0b' },
  note_update:      { label: 'Updating notes',           color: '#f59e0b' },
  note_delete:      { label: 'Trashing notes',           color: '#f59e0b' },
  task_create:      { label: 'Adding to the list',       color: '#22c55e' },
  task_read:        { label: 'Checking the list',        color: '#22c55e' },
  task_update:      { label: 'Updating the list',        color: '#22c55e' },
  task_delete:      { label: 'Crossing off the list',    color: '#22c55e' },
  generate_file:    { label: 'Generating file',          color: '#6366f1' },
  edit_document:    { label: 'Editing document',         color: '#6366f1' },
  download_url:     { label: 'Downloading file',         color: '#6366f1' },
  download_file:    { label: 'Downloading file',         color: '#6366f1' },
  browse_web:       { label: 'Browsing the web',         color: '#14b8a6' },
  read_document:    { label: 'Reading document',         color: '#14b8a6' },
  data_analysis:    { label: 'Crunching data',           color: '#3b82f6' },
  local_search:     { label: 'Searching locally',        color: '#3b82f6' },
  screenshot:       { label: 'Taking a selfie',          color: '#ec4899' },
  share_content:    { label: 'Sharing the love',         color: '#22c55e' },
  create_pdf:       { label: 'Making a PDF',             color: '#f97316' },
  sandbox_exec:     { label: 'Running in the sandbox',   color: '#8b5cf6' },
  sandbox_install:  { label: 'Installing packages',      color: '#8b5cf6' },
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
  const buildMode = useGiaStore(s => s.buildMode);
  const phases: ThinkingPhase[] = buildMode
    ? ['planning', 'gathering', 'coding', 'processing', 'reasoning']
    : ['gathering', 'reasoning', 'analyzing', 'planning', 'processing'];

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

  const extras = buildMode ? BUILD_EXTRAS : THINKING_EXTRAS;
  const activePhase = phase || phases[currentPhase];
  const buildDef = buildMode ? BUILD_PHASE_MAP[activePhase] : undefined;
  const def = buildDef || PHASE_MAP[activePhase] || PHASE_MAP.processing;

  const displayLabel = (!phase && extras.length > 0 && (currentPhase % 3 === 0)) ? extras[currentPhase % extras.length] : def.label;

  const dots = displayLabel.split('').map((char, i) => (
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
