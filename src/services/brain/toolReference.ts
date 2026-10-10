import GiaTools from '../GiaTools';

interface ToolDoc {
  id: string;
  name: string;
  description: string;
  schema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const INTERNAL_PREFIXES = ['device_plugin_', 'gateway_daemon_', 'geolocation_'];

const INTERNAL_IDS = new Set([
  'clipboard_read',
  'clipboard_write',
  'share_content',
  'haptic_impact',
  'haptic_notification',
  'haptic_vibrate',
  'notifications_check_permissions',
  'notifications_request_permissions',
]);

const VIRTUAL_TOOLS: Record<string, ToolDoc> = {
  sub_agent_call: {
    id: 'sub_agent_call',
    name: 'sub_agent_call',
    description: 'Delegate one focused task to a Nexus specialist or a locally saved custom agent. Pass a self-contained prompt with the relevant context and a distinct workstream; findings are returned for synthesis.',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Self-contained objective and context' },
        provider: { type: 'string', description: 'Optional provider id for the sub-agent' },
        agent: { type: 'string', description: 'Optional built-in persona or saved agent name' },
      },
      required: ['prompt'],
    },
  },
};

export function isToolVisibleToModel(id: string): boolean {
  if (INTERNAL_IDS.has(id)) return false;
  return !INTERNAL_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export function listModelTools(): ToolDoc[] {
  const registered = GiaTools.getAllTools().filter((tool) => tool.schema && isToolVisibleToModel(tool.id));
  const byId = new Map<string, ToolDoc>();
  for (const tool of registered) byId.set(tool.id, tool);
  for (const [id, doc] of Object.entries(VIRTUAL_TOOLS)) {
    if (!byId.has(id)) byId.set(id, doc);
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

const MAX_DESCRIPTION_CHARS = 70;

export function trimToolDescription(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_DESCRIPTION_CHARS) return flat;
  const cut = flat.slice(0, MAX_DESCRIPTION_CHARS);
  const boundary = cut.lastIndexOf(' ');
  return (boundary > MAX_DESCRIPTION_CHARS * 0.4 ? cut.slice(0, boundary) : cut) + '…';
}

export function toolArgNames(schema: ToolDoc['schema']): string {
  const props = schema?.properties ?? {};
  const keys = Object.keys(props);
  if (keys.length === 0) return 'none';
  const required = new Set(schema?.required ?? []);
  return keys.map((key) => (required.has(key) ? key : `${key}?`)).join(', ');
}

export function buildToolReferenceTable(): string {
  const tools = listModelTools();
  if (tools.length === 0) {
    return '| `_tools_` | Tool registry not ready — retry shortly | none |';
  }
  return tools
    .map((tool) => `| \`${tool.id}\` | ${trimToolDescription(tool.description)} | ${toolArgNames(tool.schema)} |`)
    .join('\n');
}

export function countModelTools(): number {
  return listModelTools().length;
}