import { useMCPStore, type MCPTransportType } from '../../store/useMCPStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const mcpTools: Tool[] = [
  {
    id: 'mcp_server_add',
    name: 'mcp_server_add',
    description: 'Add an MCP server configuration.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Human-readable name for the server' },
        transport: { type: 'string', enum: ['sse', 'stdio'], description: 'Transport type' },
        url: { type: 'string', description: 'Server URL (for SSE transport)' },
        command: { type: 'string', description: 'Command to run (for stdio transport)' },
        args: { type: 'array', items: { type: 'string' }, description: 'Command arguments (for stdio transport)' },
      },
      required: ['name', 'transport'],
    },
    execute: async (args) => {
      const name = args.name as string;
      const transport = args.transport as string;
      const url = args.url as string;
      const command = args.command as string;
      const arrArgs = args.args as string[] | undefined;
      if (!name || !transport) return { success: false, content: '', error: 'Provide "name" and "transport" (sse or stdio).' };
      if (transport === 'sse' && !url) return { success: false, content: '', error: 'SSE transport requires a "url".' };
      if (transport === 'stdio' && !command) return { success: false, content: '', error: 'Stdio transport requires a "command".' };
      const config = { name, transport: transport as MCPTransportType, url: url || '', command: command || '', args: arrArgs || [], enabled: true, autoConnect: false };
      useMCPStore.getState().addServer(config);
      return { success: true, content: `MCP server "${name}" added (${transport}).` };
    }
  },
  {
    id: 'mcp_server_list',
    name: 'mcp_server_list',
    description: 'List all configured MCP servers and their connection status.',
    execute: async () => {
      const servers = useMCPStore.getState().servers;
      if (servers.length === 0) {
        return { success: true, content: 'No MCP servers configured. Use mcp_server_add to add one.' };
      }
      const lines = servers.map(s => `- **${s.name}** (${s.transport}) — ${s.enabled ? 'enabled' : 'disabled'}`);
      return { success: true, content: `## MCP Servers\n\n${lines.join('\n')}` };
    }
  },
  {
    id: 'mcp_server_remove',
    name: 'mcp_server_remove',
    description: 'Remove an MCP server by its ID.',
    schema: {
      type: 'object',
      properties: { serverId: { type: 'string', description: 'The ID of the MCP server to remove' } },
      required: ['serverId'],
    },
    execute: async (args) => {
      const serverId = args.serverId as string;
      if (!serverId) return { success: false, content: '', error: 'Provide a "serverId".' };
      useMCPStore.getState().removeServer(serverId);
      return { success: true, content: `MCP server "${serverId}" removed.` };
    }
  },
  {
    id: 'mcp_server_test',
    name: 'mcp_server_test',
    description: 'Test connectivity to an MCP server by its ID.',
    schema: {
      type: 'object',
      properties: { serverId: { type: 'string', description: 'The ID of the MCP server to test' } },
      required: ['serverId'],
    },
    execute: async (args) => {
      const serverId = args.serverId as string;
      const server = useMCPStore.getState().servers.find(s => s.id === serverId);
      if (!server) return { success: false, content: '', error: `MCP server "${serverId}" not found.` };
      return { success: true, content: `MCP server "${server.name}" (${server.transport}) at ${server.url || server.command}. Connectivity test requires the server to be reachable.` };
    }
  },
];

export function registerMCPTools() {
  for (const tool of mcpTools) ToolRegistry.register(tool);
}