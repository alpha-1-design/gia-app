import { z } from 'zod';
import { logger } from '../../utils/logger';
import type { Tool, ToolResult } from './types';

async function sandboxExec(cmd: string, timeout = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const baseUrl = 'http://localhost:3081';
    const res = await fetch(`${baseUrl}/api/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, timeout: Math.floor(timeout / 1000) }),
      signal: AbortSignal.timeout(timeout + 2000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { stdout: '', stderr: text, exitCode: 1 };
    }
    const data = await res.json();
    return { stdout: data.stdout || '', stderr: data.stderr || '', exitCode: data.exitCode ?? 1 };
  } catch (e) {
    return { stdout: '', stderr: (e instanceof Error ? e.message : String(e)), exitCode: 1 };
  }
}

function parsePorts(input: string): number[] {
  const ports: number[] = [];
  for (const part of input.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end <= 65535 && start <= end) {
        for (let i = start; i <= end; i++) ports.push(i);
      }
    } else {
      const p = Number(trimmed);
      if (!isNaN(p) && p > 0 && p <= 65535) ports.push(p);
    }
  }
  return [...new Set(ports)].sort((a, b) => a - b);
}

const networkScan: Tool = {
  id: 'network_scan',
  name: 'network_scan',
  description: 'Scan TCP ports on a remote host to detect which services are open. Uses the sandbox environment for execution.',
  schema: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'Hostname or IP address to scan (e.g. "192.168.1.1" or "example.com")' },
      ports: { type: 'string', description: 'Ports to scan — e.g. "22,80,443" or "1-1000" or "22,80,443,3000-4000"' },
      timeout: { type: 'number', description: 'Timeout per port in ms (default 1000)' },
    },
    required: ['host', 'ports'],
  },
  execute: async (args) => {
    const schema = z.object({
      host: z.string().min(1).max(253),
      ports: z.string().min(1).max(1000),
      timeout: z.number().min(100).max(30000).optional().default(1000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { host, ports, timeout } = parsed.data;
    const portList = parsePorts(ports);
    if (portList.length === 0) return { success: false, content: '', error: 'No valid ports specified' };
    if (portList.length > 1000) return { success: false, content: '', error: 'Maximum 1000 ports per scan' };

    logger.info(`[network_scan] Scanning ${host}:${portList.length} ports`);

    const batchSize = 50;
    const openPorts: number[] = [];
    for (let i = 0; i < portList.length; i += batchSize) {
      const batch = portList.slice(i, i + batchSize);
      const cmds = batch.map(p => `(echo > /dev/tcp/${host}/${p}) 2>/dev/null && echo "OPEN:${p}" || true`);
      const script = cmds.join('; ');
      const result = await sandboxExec(script, Math.max(timeout * batchSize, 10000));
      for (const line of result.stdout.split('\n')) {
        const m = line.match(/^OPEN:(\d+)/);
        if (m) openPorts.push(parseInt(m[1]));
      }
    }

    return {
      success: true,
      content: JSON.stringify({
        host,
        totalPortsScanned: portList.length,
        openPorts,
        closedPorts: portList.length - openPorts.length,
        scanComplete: true,
      }, null, 2),
    };
  },
};

const networkConnectivity: Tool = {
  id: 'network_connectivity',
  name: 'network_connectivity',
  description: 'Test whether a specific host:port endpoint is reachable over TCP or UDP.',
  schema: {
    type: 'object',
    properties: {
      host: { type: 'string', description: 'Hostname or IP address' },
      port: { type: 'number', description: 'Port number (1-65535)' },
      protocol: { type: 'string', enum: ['tcp', 'udp'], description: 'Protocol (default tcp)' },
      timeout: { type: 'number', description: 'Timeout in ms (default 5000)' },
    },
    required: ['host', 'port'],
  },
  execute: async (args) => {
    const schema = z.object({
      host: z.string().min(1).max(253),
      port: z.number().int().min(1).max(65535),
      protocol: z.enum(['tcp', 'udp']).optional().default('tcp'),
      timeout: z.number().min(100).max(60000).optional().default(5000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { host, port, protocol, timeout } = parsed.data;
    const timeoutSec = Math.ceil(timeout / 1000);

    let cmd: string;
    if (protocol === 'tcp') {
      cmd = `timeout ${timeoutSec} bash -c '(echo > /dev/tcp/${host}/${port}) 2>/dev/null && echo "REACHABLE" || echo "UNREACHABLE"'`;
    } else {
      cmd = `timeout ${timeoutSec} bash -c '(echo "test" > /dev/udp/${host}/${port}) 2>/dev/null && echo "REACHABLE" || echo "UNREACHABLE"'`;
    }
    const result = await sandboxExec(cmd, timeout + 2000);

    return {
      success: true,
      content: JSON.stringify({
        host,
        port,
        protocol,
        reachable: result.stdout.trim() === 'REACHABLE' || result.exitCode === 0,
        detail: result.stdout.trim(),
        error: result.stderr || undefined,
      }, null, 2),
    };
  },
};

const networkDetect: Tool = {
  id: 'network_detect',
  name: 'network_detect',
  description: 'Auto-detect local network services on common ports. Scans the local subnet for open services like SSH, HTTP, databases, etc.',
  schema: {
    type: 'object',
    properties: {
      subnet: { type: 'string', description: 'Subnet to scan — e.g. "192.168.1" (defaults to auto-detected local subnet)' },
      timeout: { type: 'number', description: 'Timeout per host in ms (default 2000)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      subnet: z.string().optional(),
      timeout: z.number().min(100).max(30000).optional().default(2000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { subnet, timeout } = parsed.data;

    let targetSubnet = subnet;
    if (!targetSubnet) {
      const detect = await sandboxExec("ip route show default 2>/dev/null | awk '{print $3}' | head -1", 5000);
      const gw = detect.stdout.trim();
      const m = gw.match(/^(\d+\.\d+\.\d+)\./);
      targetSubnet = m ? m[1] : '192.168.1';
    }

    const commonPorts = [22, 80, 443, 445, 8080, 8443, 3306, 5432, 6379, 27017, 3000, 5000, 9090, 6443];
    const timeoutSec = Math.ceil(timeout / 1000);
    const hosts = [1, 2, 254];

    const results: Array<{ host: string; openPorts: number[] }> = [];
    for (const hostSuffix of hosts) {
      const host = `${targetSubnet}.${hostSuffix}`;
      const openPorts: number[] = [];
      for (const port of commonPorts) {
        const cmd = `timeout ${timeoutSec} bash -c '(echo > /dev/tcp/${host}/${port}) 2>/dev/null && echo "OPEN" || true'`;
        const r = await sandboxExec(cmd, timeout + 1000);
        if (r.stdout.trim() === 'OPEN') openPorts.push(port);
      }
      if (openPorts.length > 0) results.push({ host, openPorts });
    }

    return {
      success: true,
      content: JSON.stringify({
        subnet: targetSubnet,
        hostsScanned: hosts.length,
        servicesFound: results,
        portLegend: {
          22: 'SSH',
          80: 'HTTP',
          443: 'HTTPS',
          445: 'SMB',
          8080: 'HTTP-Alt',
          8443: 'HTTPS-Alt',
          3306: 'MySQL',
          5432: 'PostgreSQL',
          6379: 'Redis',
          27017: 'MongoDB',
          3000: 'Dev-Server',
          5000: 'Flask/Serv',
          9090: 'Prometheus',
          6443: 'K8s-API',
        },
      }, null, 2),
    };
  },
};

export const networkTools: Tool[] = [networkScan, networkConnectivity, networkDetect];
