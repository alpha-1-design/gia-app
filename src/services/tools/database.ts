import { logger } from '../../utils/logger';
import type { Tool, ToolResult } from './types';

interface DBConnection {
  id: string;
  type: 'postgresql' | 'mysql' | 'sqlite';
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
}

function getConnections(): DBConnection[] {
  try {
    return JSON.parse(localStorage.getItem('gia:db:connections') || '[]');
  } catch { return []; }
}

function saveConnections(conns: DBConnection[]) {
  localStorage.setItem('gia:db:connections', JSON.stringify(conns));
}

async function execViaSandbox(cmd: string): Promise<string> {
  const resp = await fetch('http://localhost:3081/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd }),
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`Sandbox error: ${resp.status}`);
  const data = await resp.json();
  return data.stdout + (data.stderr ? '\n' + data.stderr : '');
}

async function ensureDBClient(dbType: string): Promise<void> {
  const pkgs: Record<string, string> = {
    postgresql: 'postgresql16-client',
    mysql: 'mysql-client',
    sqlite: 'sqlite-dev',
  };
  const pkg = pkgs[dbType];
  if (!pkg) throw new Error(`Unsupported database type: ${dbType}`);
  const check = await execViaSandbox(`which ${dbType === 'postgresql' ? 'psql' : dbType === 'mysql' ? 'mysql' : 'sqlite3'} 2>/dev/null || apk add --no-cache ${pkg} 2>&1`);
  if (!check.includes('/')) throw new Error(`Failed to install ${pkg}: ${check}`);
}

const databaseTools: Tool[] = [
  {
    id: 'db_query',
    name: 'db_query',
    description: 'Execute a SQL query against a PostgreSQL, MySQL, or SQLite database. Supports both one-off connections and saved configs.',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['postgresql', 'mysql', 'sqlite'], description: 'Database type' },
        host: { type: 'string', description: 'Database host' },
        port: { type: 'number', description: 'Database port (default: 5432 for PostgreSQL, 3306 for MySQL)' },
        database: { type: 'string', description: 'Database name' },
        username: { type: 'string', description: 'Database username' },
        password: { type: 'string', description: 'Database password' },
        ssl: { type: 'boolean', description: 'Use SSL connection (default: true)' },
        query: { type: 'string', description: 'SQL query to execute' },
        connectionId: { type: 'string', description: 'Use a saved connection instead of specifying details' },
        filePath: { type: 'string', description: 'Path to SQLite database file (only for sqlite type)' },
      },
      required: ['query'],
    },
    execute: async (args): Promise<ToolResult> => {
      const dbType = args.type as string;
      const query = args.query as string;
      const connectionId = args.connectionId as string | undefined;
      const filePath = args.filePath as string | undefined;

      let host: string, port: number, database: string, username: string, password: string, ssl: boolean;

      if (connectionId) {
        const conns = getConnections();
        const conn = conns.find(c => c.id === connectionId);
        if (!conn) return { success: false, content: '', error: `Connection "${connectionId}" not found. Use db_configure first.` };
        host = conn.host;
        port = conn.port;
        database = conn.database;
        username = conn.username;
        ssl = conn.ssl;
        password = '';
      } else {
        if (!args.type) return { success: false, content: '', error: 'Database type required (postgresql, mysql, or sqlite)' };
        host = args.host as string || 'localhost';
        port = args.port as number || (dbType === 'postgresql' ? 5432 : 3306);
        database = args.database as string || '';
        username = args.username as string || '';
        password = args.password as string || '';
        ssl = args.ssl !== false;
      }

      try {
        await ensureDBClient(dbType);

        let cmd: string;
        const escapedQuery = query.replace(/"/g, '\\"').replace(/\$/g, '\\$');

        if (dbType === 'postgresql') {
          const sslMode = ssl ? 'require' : 'disable';
          const pgpass = `localhost:${port}:${database}:${username}:${password}`;
          cmd = `echo '${pgpass}' > /tmp/pgpass && chmod 600 /tmp/pgpass && PGPASSFILE=/tmp/pgpass psql -h ${host} -p ${port} -U ${username} -d ${database} -c "${escapedQuery}" --pset=tuples_only=on --pset=format=unaligned 2>&1`;
        } else if (dbType === 'mysql') {
          const sslFlag = ssl ? '--ssl-mode=REQUIRED' : '--ssl-mode=DISABLED';
          cmd = `mysql -h ${host} -P ${port} -u ${username} -p'${password.replace(/'/g, "'\\''")}' ${database ? `-D ${database}` : ''} ${sslFlag} -e "${escapedQuery}" 2>&1`;
        } else if (dbType === 'sqlite') {
          const dbPath = filePath || database;
          if (!dbPath) return { success: false, content: '', error: 'SQLite requires filePath or database name' };
          cmd = `sqlite3 -header -column "${dbPath}" "${escapedQuery}" 2>&1`;
        } else {
          return { success: false, content: '', error: `Unsupported database type: ${dbType}` };
        }

        const output = await execViaSandbox(cmd);

        if (output.toLowerCase().includes('error') || output.toLowerCase().includes('could not connect')) {
          return { success: false, content: '', error: `Query failed: ${output.slice(0, 500)}` };
        }

        return { success: true, content: `### Query Result\n\`\`\`\n${output}\n\`\`\`` };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Database query failed';
        logger.error('[db] Query error:', msg);
        return { success: false, content: '', error: msg };
      }
    },
  },
  {
    id: 'db_configure',
    name: 'db_configure',
    description: 'Save a database connection configuration for reuse. Stores credentials locally.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Name to identify this connection' },
        type: { type: 'string', enum: ['postgresql', 'mysql'], description: 'Database type' },
        host: { type: 'string', description: 'Database host' },
        port: { type: 'number', description: 'Database port' },
        database: { type: 'string', description: 'Database name' },
        username: { type: 'string', description: 'Database username' },
        ssl: { type: 'boolean', description: 'Use SSL' },
      },
      required: ['id', 'type', 'host', 'database', 'username'],
    },
    execute: async (args): Promise<ToolResult> => {
      const conn: DBConnection = {
        id: args.id as string,
        type: args.type as 'postgresql' | 'mysql',
        host: args.host as string,
        port: (args.port as number) || (args.type === 'postgresql' ? 5432 : 3306),
        database: args.database as string,
        username: args.username as string,
        ssl: args.ssl !== false,
      };
      const conns = getConnections().filter(c => c.id !== conn.id);
      conns.push(conn);
      saveConnections(conns);
      return { success: true, content: `Database connection "${conn.id}" saved (${conn.type}://${conn.host}:${conn.port}/${conn.database}). Use db_query with connectionId: "${conn.id}" to query.` };
    },
  },
  {
    id: 'db_list_connections',
    name: 'db_list_connections',
    description: 'List all saved database connections.',
    schema: { type: 'object', properties: {}, required: [] },
    execute: async (): Promise<ToolResult> => {
      const conns = getConnections();
      if (conns.length === 0) return { success: true, content: 'No saved database connections.' };
      let content = '### Saved Database Connections\n';
      for (const c of conns) {
        content += `- **${c.id}**: ${c.type}://${c.host}:${c.port}/${c.database} (SSL: ${c.ssl})\n`;
      }
      return { success: true, content };
    },
  },
  {
    id: 'db_remove_connection',
    name: 'db_remove_connection',
    description: 'Remove a saved database connection.',
    schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Connection ID to remove' } },
      required: ['id'],
    },
    execute: async (args): Promise<ToolResult> => {
      const id = args.id as string;
      saveConnections(getConnections().filter(c => c.id !== id));
      return { success: true, content: `Connection "${id}" removed.` };
    },
  },
];

export { databaseTools };
