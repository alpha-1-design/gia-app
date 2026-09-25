/**
 * AppMap — GIA's self-knowledge.
 *
 * A structured, single-source map of everything in the app: modules,
 * settings pages, the sections inside them, and the key controls. Two
 * consumers:
 *
 *  1. The system prompt (buildGiaSystem) embeds a compact digest so GIA can
 *     answer "where do I change X?" with the exact path instead of guessing.
 *  2. The app_map tool (tools/appmap.ts) lets GIA look up paths on demand
 *     and return navigation instructions the user can follow.
 *
 * Keep entries in user-facing language; ids must match the store's Module
 * union and SettingsModule's SettingsPage union.
 */

export interface AppLocation {
  /** Canonical id (module id or settings page id). */
  id: string;
  /** Where the user starts: "Chat → header pill" etc. */
  path: string;
  /** What this place is for, one sentence. */
  what: string;
  /** Key controls inside, with their effect. */
  controls: string[];
}

export const MODULES: AppLocation[] = [
  {
    id: 'chat',
    path: 'Chat (bottom nav / default screen)',
    what: 'Talk with GIA — messages, attachments, voice, tools, agents.',
    controls: [
      'Provider pill in the header — opens the model/provider switcher (connect keys, switch models inline)',
      'Tools button above the composer — Web Search, DeepSearch, Think, Hands-off, Listen, Vision, Translate, Offline toggles',
      'Paperclip / image / camera — attach files and photos',
      'Tap any message — action sheet: copy, regenerate, continue, fork, rewrite (simplify/elaborate/shorten), delete',
      'Retry + Edit & Resend on error bubbles',
    ],
  },
  {
    id: 'writer',
    path: 'Writer (bottom nav)',
    what: 'Long-form writing workspace with drafts and document export.',
    controls: ['Draft list', 'Export to PDF/document'],
  },
  {
    id: 'planner',
    path: 'Planner (bottom nav)',
    what: 'Plans and schedules — goals broken into tasks with JSON reliability retry.',
    controls: ['Generate plan', 'Task checklist'],
  },
  {
    id: 'settings',
    path: 'Settings (bottom nav)',
    what: 'Every control for GIA’s behaviour, connections, and data. See SETTINGS_PAGES.',
    controls: [],
  },
  {
    id: 'build',
    path: 'Build (in Chat via Build mode)',
    what: 'Describe an app/site; GIA builds it in the sandbox and previews the result.',
    controls: ['Build mode toggle', 'Live preview sheet'],
  },
  {
    id: 'exam',
    path: 'Exam (Settings → Profile & Identity → Exam, or module nav)',
    what: 'Adaptive practice tests with reference material and history.',
    controls: ['Start assessment', 'Reference tab', 'History'],
  },
  {
    id: 'analyst',
    path: 'Analyst (module nav)',
    what: 'Data/file analysis with structured JSON output and retry.',
    controls: ['Attach data', 'Run analysis'],
  },
  {
    id: 'autonomy',
    path: 'Autonomy (module nav)',
    what: 'Background goals GIA pursues on a schedule.',
    controls: ['Goals list', 'Enable/disable autonomy'],
  },
  {
    id: 'agents',
    path: 'Agents (module nav)',
    what: 'Create custom agents with their own personas and tool permissions; mention them with @.',
    controls: ['Agent list', 'Create agent', 'Per-agent tool toggles'],
  },
];

export const SETTINGS_PAGES: AppLocation[] = [
  {
    id: 'capabilities',
    path: 'Settings → GIA Capabilities',
    what: 'Live inventory of what this phone can run: RAM, storage, engines, shell binaries, connectors, MCP tools.',
    controls: ['Scan device', 'Engine readiness cards'],
  },
  {
    id: 'profile-identity',
    path: 'Settings → Profile & Identity',
    what: 'Your profile, GIA’s identity/name, skills, memory, pinned memories, brain export/import.',
    controls: ['Profile fields', 'GIA identity (name/persona)', 'Skills list', 'Memory settings', 'Brain export/import', 'Feedback & problem report'],
  },
  {
    id: 'connections',
    path: 'Settings → Connections',
    what: 'API connectors (OpenWeather, GitHub, …), social platforms, gateway routes, browser & search config.',
    controls: ['Connector CRUD + keys', 'Social OAuth', 'Gateway routes', 'Search provider'],
  },
  {
    id: 'mcp',
    path: 'Settings → MCP Servers',
    what: 'Model Context Protocol servers — external tool sources with OAuth.',
    controls: ['Add server', 'Tool list', 'OAuth connect'],
  },
  {
    id: 'knowledge',
    path: 'Settings → Knowledge Base',
    what: 'Upload documents for semantic search (RAG) feeding GIA’s answers.',
    controls: ['Upload doc', 'Index status', 'Delete'],
  },
  {
    id: 'permissions',
    path: 'Settings → Permissions',
    what: 'What GIA may access: camera, microphone, location, contacts, SMS, notifications, storage, overlay, alarms, DND, battery, installs.',
    controls: ['Per-permission Ask/Allowed/Denied toggle', 'System settings deep links'],
  },
  {
    id: 'system',
    path: 'Settings → System & Performance',
    what: 'Security lock, code execution endpoint, protocol approvals, voice (wake word/TTS/STT), power, reliability.',
    controls: ['App lock (biometric)', 'Sandbox endpoint', 'Protocols & approvals', 'Wake word + language + TTS', 'Power saving', 'Reliability incl. On-Device Mode'],
  },
  {
    id: 'permissions-note',
    path: 'Settings → Local AI',
    what: 'On-device LLM models (RAM-checked recommendations) and local vision models.',
    controls: ['Model list with compatibility warnings', 'Download/load/unload', 'Recommended badge'],
  },
  {
    id: 'app-extensions',
    path: 'Settings → App & Extensions',
    what: 'Plugins (manifest install), in-app updates, code history, developer settings.',
    controls: ['Plugin install', 'Check for updates', 'Developer toggles incl. Offline STT'],
  },
  {
    id: 'skills-marketplace',
    path: 'Settings → Skills Marketplace',
    what: 'Install community skills or create your own prompt-packages.',
    controls: ['Browse/install', 'Create skill', 'Manage installed'],
  },
  {
    id: 'dashboard',
    path: 'Settings → Dashboard',
    what: 'Analytics: performance, tool usage, errors, insights.',
    controls: ['Metric cards', 'Tool usage table'],
  },
  {
    id: 'unimind',
    path: 'Settings → Unimind',
    what: 'Pair a desktop GIA — presence, remote actions, cross-device lock.',
    controls: ['Pairing', 'Remote actions', 'Presence'],
  },
  {
    id: 'about',
    path: 'Settings → About',
    what: 'Version info, analytics opt-out, danger zone (reset).',
    controls: ['Version', 'Report a problem / feedback (opens email to alphariansamuel@gmail.com)', 'Reset app'],
  },
];

/** Compact digest for the system prompt — a few lines, not the full map. */
export function appMapDigest(): string {
  const modules = MODULES.map(m => `${m.id}: ${m.what}`).join(' | ');
  const pages = SETTINGS_PAGES.map(p => p.id).join(', ');
  return [
    'APP MAP — where things live (use the app_map tool for exact paths and controls):',
    `Modules: ${modules}`,
    `Settings pages: ${pages} (Settings → <page name>)`,
    'Key facts: model/provider switching lives in the Chat header pill; permission grants in Settings → Permissions; wake word & voice in Settings → System; On-Device Mode in Settings → System → Reliability and the composer Tools sheet.',
  ].join('\n');
}

/** Best-effort lookup: find a location whose id/what/controls match a query. */
export function findAppLocations(query: string): AppLocation[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const all = [...MODULES, ...SETTINGS_PAGES];
  const scored = all
    .map(loc => {
      let score = 0;
      if (loc.id.toLowerCase().includes(q)) score += 6;
      if (loc.what.toLowerCase().includes(q)) score += 4;
      if (loc.path.toLowerCase().includes(q)) score += 3;
      if (loc.controls.some(c => c.toLowerCase().includes(q))) score += 3;
      // word-level matches against all text
      const words = q.split(/\W+/).filter(w => w.length > 3);
      const text = `${loc.id} ${loc.path} ${loc.what} ${loc.controls.join(' ')}`.toLowerCase();
      for (const w of words) if (text.includes(w)) score += 1;
      return { loc, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map(s => s.loc);
}
