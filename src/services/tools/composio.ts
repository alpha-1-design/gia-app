import { z } from 'zod';
import composioService, { NO_KEY_MESSAGE, type ComposioAccount } from '../connectors/ComposioService';
import type { Tool, ToolResult } from './types';

// Output cap: tool results land in the LLM context, so cap execute output at 50KB.
const EXECUTE_OUTPUT_CAP = 50 * 1024;

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    return i.message;
  }).join('; ');
}

function truncateOutput(text: string): string {
  if (text.length <= EXECUTE_OUTPUT_CAP) return text;
  return `${text.slice(0, EXECUTE_OUTPUT_CAP)}\n\n…[truncated ${text.length - EXECUTE_OUTPUT_CAP} characters — 50KB output cap]`;
}

function errorResult(e: unknown): ToolResult {
  return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
}

function noKeyResult(): ToolResult {
  return { success: false, content: '', error: NO_KEY_MESSAGE };
}

function formatAccount(account: ComposioAccount): string {
  const when = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  return `- ${account.toolkitSlug || 'unknown'} — **${account.status}** — \`${account.id}\`${when ? ` — since ${when}` : ''}`;
}

const composioStatus: Tool = {
  id: 'composio_status',
  name: 'composio_status',
  description: 'Check whether the Composio managed-auth gateway is connected: reports if the Composio API key is saved and lists current connected accounts (Gmail, GitHub, Notion, Slack and hundreds more — all through one key).',
  execute: async () => {
    if (!composioService.hasKey()) {
      return {
        success: true,
        content: 'Composio is **not connected**. The user can paste their single Composio API key in Settings → Connections → Composio to unlock hundreds of managed OAuth connectors (Gmail, GitHub, Notion, Slack…). Composio hosts all OAuth — no per-service API keys needed.',
      };
    }
    try {
      const accounts = await composioService.listAccounts();
      if (accounts.length === 0) {
        return { success: true, content: 'Composio is connected (API key saved), but no toolkits are connected yet. Use `composio_list_toolkits` to browse the catalog and `composio_connect` to link one.' };
      }
      const lines = accounts.map(formatAccount).join('\n');
      return { success: true, content: `## 🔌 Composio Connected Accounts\n\n${lines}\n\nUse \`composio_execute\` to call any Composio tool against these accounts.` };
    } catch (e) {
      return errorResult(e);
    }
  },
};

const composioListToolkits: Tool = {
  id: 'composio_list_toolkits',
  name: 'composio_list_toolkits',
  description: 'Browse the Composio toolkit catalog (hundreds of apps: gmail, github, notion, slack, …). Returns up to 50 toolkits (slug + name), optionally filtered by a search substring.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Optional case-insensitive substring to filter toolkits by slug or name (e.g. "mail", "git", "notion")' },
    },
  },
  execute: async (args) => {
    if (!composioService.hasKey()) return noKeyResult();
    const schema = z.object({ query: z.string().optional() });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    try {
      const toolkits = await composioService.getToolkits(parsed.data.query);
      if (toolkits.length === 0) return { success: true, content: 'No matching Composio toolkits found.' };
      const shown = toolkits.slice(0, 50);
      const lines = shown.map(t => `- **${t.name}** \`${t.slug}\``).join('\n');
      const extra = toolkits.length > shown.length ? `\n\n…and ${toolkits.length - shown.length} more — refine with the query parameter.` : '';
      return { success: true, content: `## 🧰 Composio Toolkits${parsed.data.query ? ` (matching "${parsed.data.query}")` : ''}\n\n${lines}${extra}\n\nUse \`composio_connect\` with a slug to connect one.` };
    } catch (e) {
      return errorResult(e);
    }
  },
};

const composioConnect: Tool = {
  id: 'composio_connect',
  name: 'composio_connect',
  description: 'Start connecting a Composio toolkit (e.g. "gmail", "github", "notion"). NON-BLOCKING: initiates the managed OAuth flow via Composio (Composio hosts the OAuth redirect — no per-service keys) and returns the connected-account id immediately; the connection completes in the background. Check progress with composio_list_connections.',
  schema: {
    type: 'object',
    properties: {
      toolkitSlug: { type: 'string', description: 'Toolkit slug from composio_list_toolkits (e.g. "gmail", "github")' },
    },
    required: ['toolkitSlug'],
  },
  execute: async (args) => {
    if (!composioService.hasKey()) return noKeyResult();
    const schema = z.object({ toolkitSlug: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const slug = parsed.data.toolkitSlug;
    try {
      // initiateConnect gives us the account id back synchronously; tracking
      // then runs fire-and-forget (same as connectInBackground, but reusing
      // this initiation instead of starting a second one).
      const init = await composioService.initiateConnect(slug);
      composioService.trackAccount(init.id).catch(() => {
        /* background tracking only — surfaced via composio_list_connections */
      });
      return {
        success: true,
        content: `## 🔗 Composio Connect Initiated\n\n**${slug}** connection started — account \`${init.id}\`.\n\nThe OAuth handshake completes in the background${init.redirectUrl ? ' (the user may need to approve access in the opened browser window)' : ' (Composio handles this auth server-side)'}. Use \`composio_list_connections\` to check when it turns ACTIVE.`,
      };
    } catch (e) {
      return errorResult(e);
    }
  },
};

const composioListConnections: Tool = {
  id: 'composio_list_connections',
  name: 'composio_list_connections',
  description: 'List Composio connected accounts and their OAuth status (ACTIVE / INITIATED / FAILED / PENDING), including account ids needed for composio_execute.',
  execute: async () => {
    if (!composioService.hasKey()) return noKeyResult();
    try {
      const accounts = await composioService.listAccounts();
      if (accounts.length === 0) {
        return { success: true, content: 'No Composio connected accounts yet. Use `composio_list_toolkits` + `composio_connect`, or Settings → Connections → Composio.' };
      }
      const lines = accounts.map(formatAccount).join('\n');
      return { success: true, content: `## 🔌 Composio Connected Accounts\n\n${lines}` };
    } catch (e) {
      return errorResult(e);
    }
  },
};

const composioExecute: Tool = {
  id: 'composio_execute',
  name: 'composio_execute',
  description: 'Execute a Composio tool (e.g. "GMAIL_SEND_EMAIL", "GITHUB_LIST_REPOS") against a connected account. Account auto-resolution: an explicit connectedAccountId wins, then toolkitSlug, then the UPPERCASE prefix of the tool slug (GMAIL_SEND_EMAIL → gmail). Output is capped at 50KB.',
  schema: {
    type: 'object',
    properties: {
      toolSlug: { type: 'string', description: 'Composio tool slug, e.g. "GMAIL_SEND_EMAIL" or "GITHUB_LIST_REPOS"' },
      args: { type: 'object', description: 'Arguments object forwarded to the Composio tool' },
      connectedAccountId: { type: 'string', description: 'Explicit connected-account id (overrides auto-resolution)' },
      toolkitSlug: { type: 'string', description: 'Explicit toolkit slug for account resolution (overrides the prefix heuristic)' },
    },
    required: ['toolSlug'],
  },
  execute: async (toolArgs) => {
    if (!composioService.hasKey()) return noKeyResult();
    const schema = z.object({
      toolSlug: z.string().min(1),
      args: z.record(z.string(), z.unknown()).optional(),
      connectedAccountId: z.string().optional(),
      toolkitSlug: z.string().optional(),
    });
    const parsed = schema.safeParse(toolArgs);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { toolSlug, connectedAccountId, toolkitSlug } = parsed.data;

    try {
      let accountId = connectedAccountId;
      if (!accountId && toolkitSlug) {
        const account = await composioService.resolveActiveAccount(toolkitSlug);
        accountId = account?.id;
        if (!accountId) return { success: false, content: '', error: `No ACTIVE Composio account for toolkit "${toolkitSlug}" — run composio_connect first.` };
      }
      if (!accountId) {
        // UPPERCASE-prefix heuristic: "GMAIL_SEND_EMAIL" → toolkit "gmail".
        // Explicit connectedAccountId/toolkitSlug args override it.
        const match = toolSlug.match(/^([A-Z0-9]+)_/);
        if (match) {
          const account = await composioService.resolveActiveAccount(match[1].toLowerCase());
          accountId = account?.id;
        }
      }
      if (!accountId) {
        return { success: false, content: '', error: `Could not resolve a connected Composio account for "${toolSlug}". Pass connectedAccountId or toolkitSlug explicitly, or run composio_connect first.` };
      }

      const result = await composioService.executeTool(toolSlug, parsed.data.args ?? {}, accountId);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return {
        success: true,
        content: `## ⚙️ ${toolSlug} (via Composio)\n\n\`\`\`json\n${truncateOutput(text)}\n\`\`\``,
      };
    } catch (e) {
      return errorResult(e);
    }
  },
};

export const composioTools: Tool[] = [
  composioStatus,
  composioListToolkits,
  composioConnect,
  composioListConnections,
  composioExecute,
];
