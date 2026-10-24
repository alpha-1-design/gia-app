import type { MessageSegment } from '../../store/useGiaStore';
import { ACTION_META, CATEGORY_FALLBACK, TOOL_META } from './toolMeta';

export interface TraceGroup {
  key: string;
  verb: string;
  singular: string;
  plural: string;
  count: number;
  details: string[];
  failed: boolean;
  running: boolean;
  category: string;
  toolName: string;
}

const DETAIL_KEYS = ['url', 'query', 'path', 'file_path', 'command', 'pattern', 'selector', 'prompt', 'task', 'name', 'title', 'text'];

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function prettyUrl(value: string): string {
  return truncate(value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, ''), 100);
}

function parseToolStart(segment: MessageSegment): { toolName: string; args: Record<string, string>; raw: string } | null {
  const match = segment.content.match(/^🧠\s+(.+?)\s+→\s*(.*)$/m);
  if (!match) return null;
  const toolName = segment.toolName || match[1].trim();
  const raw = match[2].trim();
  const args: Record<string, string> = {};
  for (const part of raw.split(/,\s+(?=[A-Za-z_][\w-]*:\s)/)) {
    const pair = part.match(/^([A-Za-z_][\w-]*):\s*([\s\S]*)$/);
    if (pair) args[pair[1]] = pair[2].trim();
  }
  return { toolName, args, raw };
}

function detailFor(args: Record<string, string>, raw: string): string {
  for (const key of DETAIL_KEYS) {
    const value = args[key];
    if (!value) continue;
    return key === 'url' ? prettyUrl(value) : truncate(value, 120);
  }
  const first = Object.values(args)[0];
  return first ? truncate(first, 120) : truncate(raw, 120);
}

/** Groups tool calls by the verb a user would say out loud ("Searched 3 queries"). */
export function buildTrace(segments: MessageSegment[]): TraceGroup[] {
  const groups = new Map<string, TraceGroup>();

  for (const segment of segments) {
    if (segment.type !== 'tool') continue;

    const parsed = parseToolStart(segment);
    const toolName = segment.toolName || parsed?.toolName || '';
    const meta = TOOL_META[toolName];
    const category = meta?.category ?? 'other';
    const action = ACTION_META[toolName] ?? CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.other;
    const key = `${action.verb}|${action.plural}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        verb: action.verb,
        singular: action.singular,
        plural: action.plural,
        count: 0,
        details: [],
        failed: false,
        running: false,
        category,
        toolName,
      };
      groups.set(key, group);
    }

    group.count += 1;
    if (parsed) {
      const detail = detailFor(parsed.args, parsed.raw);
      if (detail && !group.details.includes(detail)) group.details.push(detail);
    }
    if (segment.toolStatus === 'failed') group.failed = true;
    if (segment.toolStatus === 'running') group.running = true;
  }

  return Array.from(groups.values());
}

export function collectThinking(segments: MessageSegment[]): string {
  return segments
    .filter(segment => segment.type === 'thinking')
    .map(segment => segment.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Splits a model preamble (text written before its first tool call) from the final answer. */
export function extractJobPlan(segments: MessageSegment[], content: string): { plan: string; body: string } {
  const firstTool = segments.findIndex(segment => segment.type === 'tool');
  if (firstTool < 0) return { plan: '', body: content };

  const planSegment = segments.slice(0, firstTool).find(segment => segment.type === 'text');
  const plan = planSegment?.content.trim() ?? '';
  if (!plan || plan.length > 600) return { plan: '', body: content };

  const trimmed = content.trimStart();
  if (!trimmed.startsWith(plan)) return { plan: '', body: content };

  return { plan, body: trimmed.slice(plan.length).trimStart() };
}

export function formatJobDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
