import { z } from 'zod';
import gatewayManager from '../gateway/GatewayManager';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

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

const gatewayAddRoute: Tool = {
  id: 'gateway_add_route',
  name: 'gateway_add_route',
  description: 'Add a new API gateway route that proxies requests to an external URL. You define a path and target, and GIA will forward requests.',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A friendly name for this route' },
      description: { type: 'string', description: 'What this route does' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'], description: 'HTTP method (ANY = match any method)' },
      path: { type: 'string', description: 'Route path (e.g. /api/weather, /users). Used for identification.' },
      targetUrl: { type: 'string', description: 'The full target URL to proxy requests to (e.g. https://api.openweathermap.org/data/2.5/weather)' },
      rateLimit: { type: 'number', description: 'Optional max requests per minute' },
      cacheTTL: { type: 'number', description: 'Optional cache TTL in seconds' },
    },
    required: ['name', 'description', 'method', 'path', 'targetUrl'],
  },
  execute: async (args) => {
    const schema = z.object({
      name: z.string().min(1).max(200),
      description: z.string().min(1).max(500),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY']),
      path: z.string().min(1).max(500),
      targetUrl: z.string().url().max(5000),
      rateLimit: z.number().min(1).max(10000).optional(),
      cacheTTL: z.number().min(1).max(86400).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { name, description, method, path, targetUrl, rateLimit, cacheTTL } = parsed.data;
    const route = gatewayManager.addRoute({
      name, description, method, path, targetUrl,
      enabled: true,
      rateLimit, cacheTTL,
      headers: undefined,
      transform: 'none',
    });
    return {
      success: true,
      content: `## 🚀 Gateway Route Created\n\n**ID:** \`${route.id}\`\n**Name:** ${name}\n**Path:** ${method} ${path}\n**Target:** ${targetUrl}\n\nUse \`gateway_call\` with this route ID to proxy a request through the gateway.`,
    };
  },
};

const gatewayList: Tool = {
  id: 'gateway_list',
  name: 'gateway_list',
  description: 'List all API gateway routes with their status, call count, and last used time.',
  execute: async () => {
    const routes = gatewayManager.getAllRoutes();
    if (routes.length === 0) {
      return { success: true, content: 'No gateway routes configured. Use `gateway_add_route` to create one.' };
    }
    const stats = gatewayManager.getStats();
    const lines = routes.map(r => {
      const icon = r.enabled ? '🟢' : '🔴';
      return `${icon} **${r.name}** \`${r.id}\`\n   ${r.method} ${r.path} → ${r.targetUrl}\n   Calls: ${r.callCount}${r.lastCalled ? ` | Last: ${new Date(r.lastCalled).toLocaleString()}` : ''}`;
    });
    return {
      success: true,
      content: `## 🌐 Gateway Routes\n\n${lines.join('\n\n')}\n\n---\n**Stats:** ${stats.enabledRoutes}/${stats.totalRoutes} enabled · ${stats.totalCalls} total calls · ${stats.successRate}% success rate · avg ${stats.avgDuration}ms`,
    };
  },
};

const gatewayCall: Tool = {
  id: 'gateway_call',
  name: 'gateway_call',
  description: 'Call an external API through a configured gateway route. Use gateway_list to find route IDs.',
  schema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Gateway route ID (use gateway_list to find this)' },
      body: { type: 'string', description: 'Optional request body as JSON string (for POST/PUT routes)' },
    },
    required: ['routeId'],
  },
  execute: async (args) => {
    const schema = z.object({
      routeId: z.string().min(1),
      body: z.string().optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const { routeId, body } = parsed.data;
    try {
      const res = await gatewayManager.proxy(routeId, body ? JSON.parse(body) : undefined);
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      return {
        success: res.status >= 200 && res.status < 400,
        content: `## 🌐 Gateway Response\n\n**Status:** ${res.status}\n**Duration:** ${res.duration}ms\n\n\`\`\`json\n${dataStr.slice(0, 30000)}\n\`\`\``,
        error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const gatewayProxy: Tool = {
  id: 'gateway_proxy',
  name: 'gateway_proxy',
  description: 'Make a direct proxied HTTP request to any URL through the gateway. All requests go through GIA\'s gateway system with logging and monitoring.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Full target URL' },
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
      const res = await gatewayManager.proxyCustom(url, method, headers ? JSON.parse(headers) : undefined, body ? JSON.parse(body) : undefined);
      const dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      return {
        success: res.status >= 200 && res.status < 400,
        content: `## 🌐 Proxy Response\n\n**Status:** ${res.status}\n**Duration:** ${res.duration}ms\n\n\`\`\`json\n${dataStr.slice(0, 30000)}\n\`\`\``,
        error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
      };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const gatewayRemove: Tool = {
  id: 'gateway_remove_route',
  name: 'gateway_remove_route',
  description: 'Remove a gateway route by its ID.',
  schema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route ID to remove' },
    },
    required: ['routeId'],
  },
  execute: async (args) => {
    const schema = z.object({ routeId: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = gatewayManager.removeRoute(parsed.data.routeId);
    return { success: ok, content: ok ? `🗑️ Route "${parsed.data.routeId}" removed.` : '', error: ok ? undefined : 'Route not found.' };
  },
};

const gatewayToggle: Tool = {
  id: 'gateway_toggle',
  name: 'gateway_toggle',
  description: 'Enable or disable a gateway route.',
  schema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route ID to toggle' },
      enabled: { type: 'boolean', description: 'true to enable, false to disable' },
    },
    required: ['routeId', 'enabled'],
  },
  execute: async (args) => {
    const schema = z.object({ routeId: z.string().min(1), enabled: z.boolean() });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const ok = gatewayManager.updateRoute(parsed.data.routeId, { enabled: parsed.data.enabled });
    return {
      success: ok,
      content: ok ? `Route ${parsed.data.enabled ? '✅ enabled' : '🔴 disabled'}.` : 'Route not found.',
      error: ok ? undefined : 'Route not found.',
    };
  },
};

const gatewayStats: Tool = {
  id: 'gateway_stats',
  name: 'gateway_stats',
  description: 'Get gateway performance statistics: total calls, success rate, average duration, and route breakdown.',
  execute: async () => {
    const stats = gatewayManager.getStats();
    const routeBreakdown = Object.entries(stats.routesByMethod)
      .map(([method, count]) => `- **${method}**: ${count} route(s)`)
      .join('\n');
    return {
      success: true,
      content: `## 🌐 Gateway Stats\n\n- **Total Routes:** ${stats.totalRoutes}\n- **Enabled:** ${stats.enabledRoutes}\n- **Total Calls:** ${stats.totalCalls}\n- **Success Rate:** ${stats.successRate}%\n- **Avg Duration:** ${stats.avgDuration}ms\n\n### By Method\n${routeBreakdown}`,
    };
  },
};

const gatewayLogs: Tool = {
  id: 'gateway_logs',
  name: 'gateway_logs',
  description: 'View recent gateway call logs. Shows the last N requests proxied through the gateway.',
  schema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Optional: filter logs by route ID' },
      limit: { type: 'number', description: 'Number of logs to return (default: 20, max: 100)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({ routeId: z.string().optional(), limit: z.number().min(1).max(100).default(20) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };
    const logs = parsed.data.routeId
      ? gatewayManager.getRouteLogs(parsed.data.routeId, parsed.data.limit)
      : gatewayManager.getLogs(parsed.data.limit);
    if (logs.length === 0) return { success: true, content: 'No gateway logs yet.' };
    const lines = logs.map(l => {
      const icon = l.status >= 200 && l.status < 400 ? '✅' : l.status === 0 ? '❌' : '⚠️';
      return `${icon} [${new Date(l.timestamp).toLocaleString()}] ${l.method} ${l.path} → ${l.status} (${l.duration}ms)${l.error ? ` — ${l.error}` : ''}`;
    });
    return { success: true, content: `## 📋 Gateway Logs (last ${logs.length})\n\n${lines.join('\n')}` };
  },
};

export const gatewayTools: Tool[] = [
  gatewayAddRoute,
  gatewayList,
  gatewayCall,
  gatewayProxy,
  gatewayRemove,
  gatewayToggle,
  gatewayStats,
  gatewayLogs,
];


export function registerGatewayTools() {
  for (const tool of gatewayTools) ToolRegistry.register(tool);
}
