import type { Tool, ToolResult } from './types';
import ToolRegistry from '../ToolRegistry';

interface WSConnection {
  url: string;
  ws: WebSocket | null;
  messages: string[];
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
}

const connections = new Map<string, WSConnection>();

function getConnection(id: string): WSConnection | undefined {
  return connections.get(id);
}

function setConnection(id: string, conn: WSConnection) {
  connections.set(id, conn);
}

const websocketTools: Tool[] = [
  {
    id: 'ws_connect',
    name: 'ws_connect',
    description: 'Connect to a WebSocket endpoint for real-time communication. Stores the connection for subsequent send/receive/close operations.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'WebSocket URL (ws:// or wss://)' },
        connectionId: { type: 'string', description: 'Name for this connection (default: auto-generated from URL)' },
      },
      required: ['url'],
    },
    execute: async (args): Promise<ToolResult> => {
      const url = args.url as string;
      const connId = (args.connectionId as string) || `ws_${Date.now()}`;

      if (connections.has(connId)) {
        const existing = connections.get(connId)!;
        if (existing.state === 'connected') {
          return { success: true, content: `Already connected to ${url} (connectionId: "${connId}").` };
        }
        connections.delete(connId);
      }

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, content: '', error: `WebSocket connection to ${url} timed out after 10s` });
        }, 10000);

        try {
          const ws = new WebSocket(url);
          const conn: WSConnection = { url, ws, messages: [], state: 'connecting' };
          setConnection(connId, conn);

          ws.onopen = () => {
            clearTimeout(timeout);
            conn.state = 'connected';
            setConnection(connId, conn);
            resolve({ success: true, content: `Connected to ${url} (connectionId: "${connId}"). Use ws_send and ws_receive to interact.` });
          };

          ws.onmessage = (event) => {
            conn.messages.push(event.data);
            setConnection(connId, conn);
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            conn.state = 'error';
            setConnection(connId, conn);
            resolve({ success: false, content: '', error: `WebSocket error connecting to ${url}` });
          };

          ws.onclose = () => {
            conn.state = 'disconnected';
            conn.ws = null;
            setConnection(connId, conn);
          };
        } catch (e) {
          clearTimeout(timeout);
          resolve({ success: false, content: '', error: `Failed to create WebSocket: ${e instanceof Error ? e.message : 'Unknown error'}` });
        }
      });
    },
  },
  {
    id: 'ws_send',
    name: 'ws_send',
    description: 'Send a message through an active WebSocket connection.',
    schema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Connection ID from ws_connect' },
        message: { type: 'string', description: 'Message to send' },
      },
      required: ['connectionId', 'message'],
    },
    execute: async (args): Promise<ToolResult> => {
      const connId = args.connectionId as string;
      const message = args.message as string;
      const conn = getConnection(connId);

      if (!conn) return { success: false, content: '', error: `No WebSocket connection "${connId}". Use ws_connect first.` };
      if (conn.state !== 'connected' || !conn.ws) {
        return { success: false, content: '', error: `WebSocket "${connId}" is not connected (state: ${conn.state})` };
      }

      try {
        conn.ws.send(message);
        return { success: true, content: `Message sent on "${connId}": ${message}` };
      } catch (e) {
        return { success: false, content: '', error: `Failed to send: ${e instanceof Error ? e.message : 'Unknown error'}` };
      }
    },
  },
  {
    id: 'ws_receive',
    name: 'ws_receive',
    description: 'Read all pending messages from a WebSocket connection. Does NOT wait for new messages — returns whatever has been received so far. For waiting, use ws_wait.',
    schema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Connection ID from ws_connect' },
      },
      required: ['connectionId'],
    },
    execute: async (args): Promise<ToolResult> => {
      const connId = args.connectionId as string;
      const conn = getConnection(connId);

      if (!conn) return { success: false, content: '', error: `No WebSocket connection "${connId}". Use ws_connect first.` };

      const messages = [...conn.messages];
      conn.messages = [];
      setConnection(connId, conn);

      if (messages.length === 0) {
        return { success: true, content: `No messages received on "${connId}" yet.` };
      }
      return { success: true, content: `### Messages from "${connId}"\n${messages.join('\n---\n')}` };
    },
  },
  {
    id: 'ws_wait',
    name: 'ws_wait',
    description: 'Wait for a new message on a WebSocket connection. Blocks until a message arrives or timeout.',
    schema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Connection ID from ws_connect' },
        timeout: { type: 'number', description: 'Max wait time in seconds (default: 30)' },
      },
      required: ['connectionId'],
    },
    execute: async (args): Promise<ToolResult> => {
      const connId = args.connectionId as string;
      const timeoutSec = (args.timeout as number) || 30;
      const conn = getConnection(connId);

      if (!conn) return { success: false, content: '', error: `No WebSocket connection "${connId}". Use ws_connect first.` };
      if (conn.state !== 'connected') {
        return { success: false, content: '', error: `WebSocket "${connId}" is not connected (state: ${conn.state})` };
      }

      if (conn.messages.length > 0) {
        const msgs = [...conn.messages];
        conn.messages = [];
        setConnection(connId, conn);
        return { success: true, content: `### Messages from "${connId}"\n${msgs.join('\n---\n')}` };
      }

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({ success: true, content: `Timed out waiting for messages on "${connId}" after ${timeoutSec}s. No messages received.` });
        }, timeoutSec * 1000);

        const handler = (event: MessageEvent) => {
          clearTimeout(timer);
          const msg = event.data;
          const conn2 = getConnection(connId);
          if (conn2) {
            conn2.messages = conn2.messages.filter(m => m !== msg);
            setConnection(connId, conn2);
          }
          resolve({ success: true, content: `### Message from "${connId}"\n${msg}` });
        };

        const ws = conn.ws;
        if (ws) {
          ws.addEventListener('message', handler, { once: true });
        } else {
          clearTimeout(timer);
          resolve({ success: false, content: '', error: 'WebSocket connection lost' });
        }
      });
    },
  },
  {
    id: 'ws_close',
    name: 'ws_close',
    description: 'Close a WebSocket connection.',
    schema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Connection ID to close' },
      },
      required: ['connectionId'],
    },
    execute: async (args): Promise<ToolResult> => {
      const connId = args.connectionId as string;
      const conn = getConnection(connId);

      if (!conn) return { success: false, content: '', error: `No WebSocket connection "${connId}".` };

      if (conn.ws) {
        conn.ws.close();
      }
      connections.delete(connId);
      return { success: true, content: `WebSocket "${connId}" closed.` };
    },
  },
  {
    id: 'ws_status',
    name: 'ws_status',
    description: 'Check status of all active WebSocket connections.',
    schema: { type: 'object', properties: {}, required: [] },
    execute: async (): Promise<ToolResult> => {
      if (connections.size === 0) return { success: true, content: 'No active WebSocket connections.' };
      let content = '### WebSocket Connections\n';
      for (const [id, conn] of connections) {
        content += `- **${id}**: ${conn.url} (${conn.state}, ${conn.messages.length} pending messages)\n`;
      }
      return { success: true, content };
    },
  },
];

export { websocketTools };


export function registerWebsocketTools() {
  for (const tool of websocketTools) ToolRegistry.register(tool);
}
