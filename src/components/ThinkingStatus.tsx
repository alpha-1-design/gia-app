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

const PHASE_MAP: Record<ThinkingPhase, { label: string; color: string }> = {
  gathering:  { label: 'Reading context', color: '#a1a1aa' },
  analyzing:  { label: 'Analyzing',       color: '#a1a1aa' },
  coding:     { label: 'Writing code',    color: '#a1a1aa' },
  writing:    { label: 'Writing',         color: '#a1a1aa' },
  searching:  { label: 'Searching',       color: '#a1a1aa' },
  planning:   { label: 'Planning',        color: '#a1a1aa' },
  reasoning:  { label: 'Thinking',        color: '#a1a1aa' },
  processing: { label: 'Working',         color: '#a1a1aa' },
  idle:       { label: 'Ready',           color: '#71717a' },
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  read_url: 'Reading a page',
  browser_navigate: 'Opening a page',
  check_website: 'Checking a site',
  page_info: 'Reading page info',
  web_scrape: 'Reading a page',
  terminal_run: 'Running a command',
  terminal_status: 'Checking a command',
  terminal_kill: 'Stopping a command',
  filesystem_read: 'Reading a file',
  filesystem_write: 'Writing a file',
  list_files: 'Listing files',
  file_search: 'Searching files',
  file_get: 'Reading a file',
  file_list: 'Listing files',
  image_generation: 'Generating an image',
  zip_project: 'Packing the project',
  http_request: 'Calling an API',
  delegate_task: 'Asking a specialist',
  request_clarification: 'Waiting for you',
  code_execute: 'Running code',
  python_execute: 'Running code',
  build_project: 'Building',
  neura_query: 'Searching memory',
  save_memory: 'Saving a memory',
  note_create: 'Writing a note',
  note_read: 'Reading a note',
  task_create: 'Adding a task',
  sandbox_exec: 'Running in the sandbox',
  sandbox_install: 'Installing packages',
  sandbox_clone: 'Cloning a repo',
  browse_web: 'Searching the web',
  screenshot: 'Taking a screenshot',
  create_pdf: 'Creating a PDF',
};

// Shared with the streaming cursor. Not a component.
// eslint-disable-next-line react-refresh/only-export-components
export function statusLabel(phase?: ThinkingPhase, toolName?: string | null): string {
  if (toolName && TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName) return toolName.replace(/_/g, ' ');
  if (phase && PHASE_MAP[phase]) return PHASE_MAP[phase].label;
  return 'Thinking';
}

/** One stable line. The label does not rotate, fade per letter, or change color mid-thought. */
export function ThinkingStatus({ phase, toolName, onTap }: { phase?: ThinkingPhase; toolName?: string | null; onTap?: () => void }) {
  const label = statusLabel(phase, toolName);
  return (
    <div
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      className="inline-flex items-center gap-2 py-1"
      style={{ cursor: onTap ? 'pointer' : 'default' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#e4e4e7' }} />
      <span
        className="text-[13px] font-medium"
        style={{
          backgroundImage: 'linear-gradient(90deg, #a1a1aa 0%, #fafafa 45%, #a1a1aa 90%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'shimmer 2.8s linear infinite',
        }}
      >
        {label}
      </span>
    </div>
  );
}
