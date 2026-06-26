import { logger } from '../../utils/logger';
import type { Tool, ToolResult } from './types';

interface SSHConnection {
  id: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  keyName?: string;
}

function getConnections(): SSHConnection[] {
  try {
    return JSON.parse(localStorage.getItem('gia:ssh:connections') || '[]');
  } catch { return []; }
}

function saveConnections(conns: SSHConnection[]) {
  localStorage.setItem('gia:ssh:connections', JSON.stringify(conns));
}

function getSavedKeys(): string[] {
  try {
    return JSON.parse(localStorage.getItem('gia:ssh:keys') || '[]');
  } catch { return []; }
}

function saveKey(name: string, key: string) {
  const keys = JSON.parse(localStorage.getItem('gia:ssh:keys') || '[]');
  keys.push({ name, key });
  localStorage.setItem('gia:ssh:keys', JSON.stringify(keys));
}

async function execViaSandbox(cmd: string): Promise<string> {
  const resp = await fetch('http://localhost:3081/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Sandbox error: ${resp.status}`);
  const data = await resp.json();
  return data.stdout + (data.stderr ? '\n' + data.stderr : '');
}

const sshTools: Tool[] = [
  {
    id: 'ssh_connect',
    name: 'ssh_connect',
    description: 'SSH into a remote machine and execute a command. Stores connection config for reuse. First call per host auto-installs openssh-client in sandbox.',
    schema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Hostname or IP address' },
        port: { type: 'number', description: 'SSH port (default 22)' },
        username: { type: 'string', description: 'SSH username' },
        authType: { type: 'string', enum: ['password', 'key'], description: 'Authentication type' },
        password: { type: 'string', description: 'Password (only for password auth)' },
        keyName: { type: 'string', description: 'Name of saved SSH key (only for key auth)' },
        command: { type: 'string', description: 'Command to execute on remote machine' },
        saveAs: { type: 'string', description: 'Save this connection with a name for reuse' },
      },
      required: ['host', 'username', 'command'],
    },
    execute: async (args): Promise<ToolResult> => {
      const host = args.host as string;
      const port = (args.port as number) || 22;
      const username = args.username as string;
      const authType = (args.authType as string) || 'password';
      const command = args.command as string;
      const saveAs = args.saveAs as string | undefined;
      const password = args.password as string | undefined;
      const keyName = args.keyName as string | undefined;

      try {
        const conns = getConnections();
        const existing = conns.find(c => c.host === host && c.username === username);

        if (saveAs && !existing) {
          conns.push({ id: saveAs, host, port, username, authType: authType as 'password' | 'key', keyName });
          saveConnections(conns);
        }

        let cmd: string;
        if (authType === 'password') {
          if (!password) return { success: false, content: '', error: 'Password required for password auth' };
          const escaped = password.replace(/'/g, "'\\''");
          cmd = `sshpass -p '${escaped}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${port} ${username}@${host} '${command.replace(/'/g, "'\\''")}'`;
        } else {
          const kName = keyName || existing?.keyName;
          if (!kName) return { success: false, content: '', error: 'No SSH key specified. Use ssh_add_key first or use password auth.' };
          const keys = JSON.parse(localStorage.getItem('gia:ssh:keys') || '[]');
          const keyEntry = keys.find((k: { name: string }) => k.name === kName);
          if (!keyEntry) return { success: false, content: '', error: `SSH key "${kName}" not found` };
          cmd = `echo '${keyEntry.key}' > /tmp/ssh_key && chmod 600 /tmp/ssh_key && ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /tmp/ssh_key -p ${port} ${username}@${host} '${command.replace(/'/g, "'\\''")}'`;
        }

        let output: string;
        try {
          output = await execViaSandbox(cmd);
        } catch {
          const install = await execViaSandbox('apk add --no-cache openssh-client sshpass 2>&1');
          if (!install.includes('OK')) {
            return { success: false, content: '', error: 'Cannot install ssh client in sandbox. Ensure sandbox is running.' };
          }
          output = await execViaSandbox(cmd);
        }

        return { success: true, content: `[${username}@${host}:${port}] $ ${command}\n${output}` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'SSH connection failed';
        logger.error('[ssh] Connection error:', msg);
        return { success: false, content: '', error: msg };
      }
    },
  },
  {
    id: 'ssh_add_key',
    name: 'ssh_add_key',
    description: 'Store an SSH private key for key-based authentication. Keys are stored locally and only sent to the remote host during SSH connections.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to identify this key' },
        key: { type: 'string', description: 'Private key content (including BEGIN/END lines)' },
      },
      required: ['name', 'key'],
    },
    execute: async (args): Promise<ToolResult> => {
      const name = args.name as string;
      const key = args.key as string;
      saveKey(name, key);
      return { success: true, content: `SSH key "${name}" saved. You can now use it with ssh_connect (keyName: "${name}").` };
    },
  },
  {
    id: 'ssh_list_connections',
    name: 'ssh_list_connections',
    description: 'List all saved SSH connections and keys.',
    schema: { type: 'object', properties: {}, required: [] },
    execute: async (): Promise<ToolResult> => {
      const conns = getConnections();
      const keys = getSavedKeys();
      let content = '';
      if (conns.length === 0) content += 'No saved connections.\n';
      else {
        content += '### Saved Connections\n';
        for (const c of conns) {
          content += `- **${c.id}**: ${c.username}@${c.host}:${c.port} (${c.authType})\n`;
        }
      }
      if (keys.length > 0) {
        content += '\n### Saved Keys\n';
        for (const k of keys) {
          content += `- ${k}\n`;
        }
      }
      return { success: true, content: content || 'No connections or keys saved.' };
    },
  },
  {
    id: 'ssh_remove_connection',
    name: 'ssh_remove_connection',
    description: 'Remove a saved SSH connection.',
    schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Connection ID to remove' } },
      required: ['id'],
    },
    execute: async (args): Promise<ToolResult> => {
      const id = args.id as string;
      const conns = getConnections().filter(c => c.id !== id);
      saveConnections(conns);
      return { success: true, content: `Connection "${id}" removed.` };
    },
  },
];

export { sshTools };
