#!/usr/bin/env node
/**
 * GIA Stdio MCP Bridge
 *
 * Spawns stdio-based MCP servers and exposes them as a single SSE endpoint
 * so GIA (running in the browser) can use them.
 *
 * Usage:
 *   node gia-stdio-bridge.js --config servers.json [--port 3080]
 *
 * Config format (JSON file):
 *   [
 *     {
 *       "name": "Filesystem",
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
 *     },
 *     {
 *       "name": "Git",
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-git"]
 *     }
 *   ]
 *
 * Or pipe config via stdin:
 *   echo '[{"name":"Filesystem","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","."]}]' | node gia-stdio-bridge.js
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.PORT || '3080', 10);
const configArg = process.argv.find(a => a.startsWith('--config='));

let servers = [];

if (configArg) {
  const configPath = configArg.split('=')[1];
  servers = JSON.parse(readFileSync(configPath, 'utf-8'));
} else {
  // Read from stdin
  const chunks = [];
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    stdin.setEncoding('utf-8');
    for await (const chunk of stdin) chunks.push(chunk);
    if (chunks.length > 0) {
      servers = JSON.parse(chunks.join(''));
    }
  }
}

if (servers.length === 0) {
  console.error('No MCP servers configured.');
  console.error('Usage: node gia-stdio-bridge.js --config servers.json');
  process.exit(1);
}

// Store child processes for cleanup
const children = [];

// Spawn each stdio server and wrap it
async function start() {
  // Each stdio server gets a "virtual" SSE-style proxy.
  // We use raw JSON-RPC over the spawned process's stdin/stdout.

  const serverTools = new Map(); // toolName -> { serverIndex, tool }

  for (let i = 0; i < servers.length; i++) {
    const cfg = servers[i];
    console.error(`[bridge] Spawning: ${cfg.name} (${cfg.command} ${(cfg.args || []).join(' ')})`);

    const child = spawn(cfg.command, cfg.args || [], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, ...cfg.env },
    });
    children.push(child);

    // Buffer stdout for JSON-RPC messages
    let buffer = '';

    child.stdout.on('data', (data) => {
      buffer += data.toString();
      // MCP stdio uses newline-delimited JSON
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
       for (const line of lines) {
         if (!line.trim()) continue;
         try {
           const msg = JSON.parse(line);
           handleMessage(i, cfg.name, child, msg);
          } catch {
            // Ignore parse errors - they'll be handled by the next chunk
          }
       }
    });

       child.on('error', () => console.error(`[bridge] ${cfg.name} error`));
       child.on('exit', (code) => console.error(`[bridge] ${cfg.name} exited (${code})`));

    // Send initialize request
    sendJsonRpc(child, {
      jsonrpc: '2.0',
      id: `init-${i}`,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'gia-bridge', version: '1.0.0' },
      },
    });

    // Small delay to let init complete
    await new Promise(r => setTimeout(r, 500));
  }

  // Start HTTP SSE server
  const httpServer = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/sse') {
      // SSE endpoint
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'endpoint', params: { url: `http://localhost:${PORT}/message` } })}\n\n`);

      // Send tools list
      const allTools = [];
      for (const [, tools] of serverTools) {
        allTools.push({
          name: tools.name,
          description: tools.description,
          inputSchema: tools.inputSchema,
        });
      }

      res.write(`data: ${JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: { tools: allTools },
      })}\n\n`);

      // Keep alive
      const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);
      req.on('close', () => clearInterval(keepAlive));

      return;
    }

    if (req.method === 'POST' && req.url === '/message') {
      let body = '';
      req.on('data', (chunk) => body += chunk);
       req.on('end', () => {
         try {
           const msg = JSON.parse(body);
           handleClientMessage(msg);
          } catch {
            // Ignore JSON parse errors
          }
       });
      return;
    }

    // Handle OPTIONS for CORS
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        servers: servers.length,
        tools: serverTools.size,
      }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(PORT, () => {
    console.error(`[bridge] GIA MCP Bridge running at http://localhost:${PORT}`);
    console.error(`[bridge] Connect GIA to SSE: http://localhost:${PORT}/sse`);
  });

  // Handle shutdown
  const shutdown = () => {
    console.error('\n[bridge] Shutting down...');
    for (const child of children) {
      child.kill();
    }
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Track SSE clients (placeholder for future use)

  function handleClientMessage(msg) {
    const serverIdx = msg.serverIndex ?? 0;
    const child = children[serverIdx];
    if (!child || !child.stdin.writable) return;

    if (msg.method === 'tools/list') {
      // Return cached tools
      const tools = [];
      for (const [, t] of serverTools) {
        tools.push(t);
      }
      // We can't push back to SSE here directly, but GIA's MCPClient handles this
      // via the initial SSE messages. For tool calls, route to the right server.
      return;
    }

    if (msg.method === 'tools/call') {
      const toolName = msg.params?.name;
      // Find which server has this tool
      for (const [name, info] of serverTools) {
        if (name === toolName) {
          const targetChild = children[info.serverIndex];
          if (targetChild) {
            sendJsonRpc(targetChild, {
              jsonrpc: '2.0',
              id: msg.id || `call-${Date.now()}`,
              method: 'tools/call',
              params: msg.params,
            });
          }
          return;
        }
      }
      return;
    }

    // Forward to server
    sendJsonRpc(child, msg);
  }

  function handleMessage(serverIdx, serverName, child, msg) {
    if (msg.method === 'tools/list' && msg.params?.tools) {
      for (const tool of msg.params.tools) {
        const key = `${serverName}__${tool.name}`;
        serverTools.set(key, {
          serverIndex: serverIdx,
          serverName,
          name: key,
          description: `[${serverName}] ${tool.description || ''}`,
          inputSchema: tool.inputSchema || {},
        });
      }
      console.error(`[bridge] ${serverName}: ${msg.params.tools.length} tools registered`);
      return;
    }

    // Tool call result
    if (msg.id && (msg.result || msg.error)) {
      // Forward result back to GIA via... we need SSE push
      // For now, we use a simplified approach: the tool call response
      // goes back through the MCP protocol. GIA's MCPClient handles this.
    }

    // Initialized notification
    if (msg.method === 'initialized') {
      // Now we can list tools
      sendJsonRpc(child, {
        jsonrpc: '2.0',
        id: `list-${serverIdx}`,
        method: 'tools/list',
        params: {},
      });
    }
  }
}

function sendJsonRpc(child, msg) {
  if (child?.stdin?.writable) {
    child.stdin.write(JSON.stringify(msg) + '\n');
  }
}

start().catch((err) => {
  console.error('[bridge] Fatal:', err);
  process.exit(1);
});
