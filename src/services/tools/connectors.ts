import { z } from 'zod';
import connectorManager from '../connectors/ConnectorManager';
import type { Tool } from './types';

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

const connectorList: Tool = {
  id: 'connector_list',
  name: 'connector_list',
  description: 'List all available API connectors and their connection status. Includes OpenWeatherMap, NewsAPI, GitHub, SendGrid, Twilio, Telegram Bot, and more.',
  execute: async () => {
    const connectors = connectorManager.getAll();
    if (connectors.length === 0) return { success: true, content: 'No connectors available.' };
    const byType: Record<string, typeof connectors> = {};
    for (const c of connectors) {
      (byType[c.type] ||= []).push(c);
    }
    const typeLabels: Record<string, string> = {
      api: '🌐 APIs', database: '🗄️ Databases', cloud: '☁️ Cloud',
      storage: '💾 Storage', messaging: '✉️ Messaging', analytics: '📊 Analytics',
    };
    let content = '# Available Connectors\n\n';
    for (const [type, items] of Object.entries(byType)) {
      content += `## ${typeLabels[type] || type}\n`;
      for (const c of items) {
        const statusIcon = c.status === 'connected' ? '✅' : c.status === 'error' ? '❌' : '⏹️';
        content += `${statusIcon} **${c.name}** \`${c.id}\`\n   ${c.description}\n   Status: ${c.status}${c.errorMessage ? ` — ${c.errorMessage}` : ''}\n\n`;
      }
    }
    content += 'Use `connector_configure` to set up a connector with your API key.';
    return { success: true, content };
  },
};

const connectorConfigure: Tool = {
  id: 'connector_configure',
  name: 'connector_configure',
  description: 'Configure an API connector with your API key and settings. Use connector_list to see available connectors.',
  schema: {
    type: 'object',
    properties: {
      connectorId: { type: 'string', description: 'Connector ID (e.g. openweather, newsapi, twilio, telegram)' },
      apiKey: { type: 'string', description: 'Your API key for the service' },
      baseUrl: { type: 'string', description: 'Optional custom base URL' },
    },
    required: ['connectorId', 'apiKey'],
  },
  execute: async (args) => {
    const schema = z.object({
      connectorId: z.string().min(1),
      apiKey: z.string().min(1),
      baseUrl: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { connectorId, apiKey, baseUrl } = parsed.data;
    const ok = connectorManager.configure(connectorId, { apiKey, enabled: true, baseUrl });
    if (!ok) return { success: false, content: '', error: `Connector "${connectorId}" not found.` };
    await connectorManager.testConnection(connectorId);
    const connector = connectorManager.get(connectorId);
    return {
      success: true,
      content: `## 🔌 Connector Configured\n\n**${connector?.name || connectorId}** is now ${connector?.status === 'connected' ? '✅ connected' : '⚠️ configured'}.\n\nUse \`connector_call\` to make API calls through this connector.`,
    };
  },
};

const connectorCall: Tool = {
  id: 'connector_call',
  name: 'connector_call',
  description: 'Make an API call through a configured connector. Use connector_list to find connector IDs and connector_configure to set them up first.',
  schema: {
    type: 'object',
    properties: {
      connectorId: { type: 'string', description: 'Connector ID (e.g. openweather, newsapi, github)' },
      endpoint: { type: 'string', description: 'API endpoint path (e.g. /weather?q=London or /repos/alpha-1-design/gia-app)' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default: GET)' },
      body: { type: 'string', description: 'Optional request body as JSON string (for POST/PUT/PATCH)' },
    },
    required: ['connectorId', 'endpoint'],
  },
  execute: async (args) => {
    const schema = z.object({
      connectorId: z.string().min(1),
      endpoint: z.string().min(1).max(5000),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
      body: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { connectorId, endpoint, method, body } = parsed.data;
    try {
      const res = await connectorManager.call(connectorId, {
        endpoint,
        method,
        body: body ? JSON.parse(body) : undefined,
      });
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      return {
        success: res.status >= 200 && res.status < 400,
        content: `## 🔌 ${connectorId} Response\n\n**Status:** ${res.status}\n**Duration:** ${res.duration}ms\n\n\`\`\`json\n${dataStr.slice(0, 30000)}\n\`\`\``,
        error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const connectorTest: Tool = {
  id: 'connector_test',
  name: 'connector_test',
  description: 'Test a connector connection to verify the API key and configuration work.',
  schema: {
    type: 'object',
    properties: {
      connectorId: { type: 'string', description: 'Connector ID to test' },
    },
    required: ['connectorId'],
  },
  execute: async (args) => {
    const schema = z.object({ connectorId: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = await connectorManager.testConnection(parsed.data.connectorId);
    const connector = connectorManager.get(parsed.data.connectorId);
    return {
      success: ok,
      content: ok
        ? `✅ **${connector?.name}** — Connection successful!`
        : `❌ **${connector?.name}** — Connection failed. ${connector?.errorMessage || 'Check your API key.'}`,
      error: ok ? undefined : 'Connection test failed',
    };
  },
};

const connectorRaw: Tool = {
  id: 'connector_raw',
  name: 'connector_raw',
  description: 'Make a raw HTTP request to any URL. Useful for calling external APIs directly without going through a configured connector.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full URL to request' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default: GET)' },
      headers: { type: 'string', description: 'Optional JSON object of headers as string' },
      body: { type: 'string', description: 'Optional request body as JSON string' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const schema = z.object({
      url: z.string().url().max(5000),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
      headers: z.string().optional(),
      body: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { url, method, headers, body } = parsed.data;
    try {
      const res = await connectorManager.callRaw(url, method, headers ? JSON.parse(headers) : undefined, body ? JSON.parse(body) : undefined);
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      return {
        success: res.status >= 200 && res.status < 400,
        content: `## Raw HTTP Response\n\n**Status:** ${res.status}\n**Duration:** ${res.duration}ms\n\n\`\`\`json\n${dataStr.slice(0, 30000)}\n\`\`\``,
        error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const connectorRemove: Tool = {
  id: 'connector_remove',
  name: 'connector_remove',
  description: 'Remove a configured connector and its API key.',
  schema: {
    type: 'object',
    properties: {
      connectorId: { type: 'string', description: 'Connector ID to remove' },
    },
    required: ['connectorId'],
  },
  execute: async (args) => {
    const schema = z.object({ connectorId: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = connectorManager.remove(parsed.data.connectorId);
    return { success: ok, content: ok ? `🗑️ Connector "${parsed.data.connectorId}" removed.` : '', error: ok ? undefined : 'Connector not found.' };
  },
};

export const connectorTools: Tool[] = [
  connectorList,
  connectorConfigure,
  connectorCall,
  connectorTest,
  connectorRaw,
  connectorRemove,
];
