import SandboxService from '../SandboxService';
import type { Tool } from './types';

const sandboxExec: Tool = {
  id: 'sandbox_exec',
  name: 'sandbox_exec',
  description: 'Execute any command in GIA\'s built-in Alpine Linux sandbox. Root access inside the sandbox. Supports all Alpine/APK packages. Use for running scripts, compiling code, testing commands, or any Linux task.',
  schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute (e.g. "python3 script.py", "gcc main.c -o main && ./main")' },
      workdir: { type: 'string', description: 'Working directory relative to workspace (default: /workspace)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 60000)' },
    },
    required: ['command'],
  },
  execute: async (args) => {
    const command = String(args.command || '');
    const workdir = args.workdir ? String(args.workdir) : undefined;
    const timeout = args.timeout ? Number(args.timeout) : undefined;

    if (!command) return { success: false, content: '', error: 'command is required' };

    const available = await SandboxService.ensureAvailable();
    if (!available) {
      return {
        success: false,
        content: '',
        error: 'Alpine sandbox is not available. Make sure the sandbox server is running (node server/sandbox-server.js)',
      };
    }

    try {
      const result = await SandboxService.exec(command, { timeout, workdir });
      const parts: string[] = [];
      if (result.stdout) parts.push(result.stdout);
      if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
      if (result.exitCode !== 0) parts.push(`\nExit code: ${result.exitCode}`);
      return { success: result.exitCode === 0, content: parts.join('\n\n') || '(no output)', error: result.exitCode !== 0 ? `Exit code ${result.exitCode}` : undefined };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const sandboxInstall: Tool = {
  id: 'sandbox_install',
  name: 'sandbox_install',
  description: 'Install Alpine Linux (APK) packages in the sandbox. Packages persist across sessions.',
  schema: {
    type: 'object',
    properties: {
      packages: {
        type: 'string',
        description: 'Package name(s) to install (space-separated, e.g. "python3 nodejs gcc git curl ffmpeg")',
      },
    },
    required: ['packages'],
  },
  execute: async (args) => {
    const packages = String(args.packages || '');
    if (!packages) return { success: false, content: '', error: 'packages is required' };

    const available = await SandboxService.ensureAvailable();
    if (!available) {
      return { success: false, content: '', error: 'Alpine sandbox is not available. Start the sandbox server first.' };
    }

    try {
      const result = await SandboxService.install(packages.split(/\s+/).filter(Boolean));
      if (result.exitCode !== 0) {
        return { success: false, content: result.stdout, error: result.stderr || `Exit code ${result.exitCode}` };
      }
      return { success: true, content: `Installed: ${packages}\n${result.stdout}` };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const sandboxClone: Tool = {
  id: 'sandbox_clone',
  name: 'sandbox_clone',
  description: 'Clone a git repository into the sandbox workspace. Uses git clone --depth 1 for speed.',
  schema: {
    type: 'object',
    properties: {
      repo: { type: 'string', description: 'Git repository URL (https:// or git://)' },
      dest: { type: 'string', description: 'Destination directory name (optional, defaults to repo name)' },
    },
    required: ['repo'],
  },
  execute: async (args) => {
    const repo = String(args.repo || '');
    const dest = args.dest ? String(args.dest) : undefined;
    if (!repo) return { success: false, content: '', error: 'repo URL is required' };

    const available = await SandboxService.ensureAvailable();
    if (!available) {
      return { success: false, content: '', error: 'Alpine sandbox is not available.' };
    }

    try {
      const result = await SandboxService.clone(repo, dest);
      if (result.exitCode !== 0) {
        return { success: false, content: result.stdout, error: result.stderr || `Exit code ${result.exitCode}` };
      }
      return { success: true, content: `Cloned ${repo} successfully\n${result.stdout}` };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const sandboxFS: Tool = {
  id: 'sandbox_fs',
  name: 'sandbox_fs',
  description: 'Read, write, delete, or list files and directories in the sandbox workspace. Paths are relative to /workspace. Root access inside sandbox.',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'delete', 'list'],
        description: 'File operation to perform',
      },
      path: { type: 'string', description: 'File/directory path relative to workspace root' },
      content: { type: 'string', description: 'File content (required for write action)' },
    },
    required: ['action', 'path'],
  },
  execute: async (args) => {
    const action = String(args.action || '');
    const filePath = String(args.path || '');
    const content = args.content !== undefined ? String(args.content) : undefined;

    if (!action || !filePath) return { success: false, content: '', error: 'action and path are required' };

    const available = await SandboxService.ensureAvailable();
    if (!available) {
      return { success: false, content: '', error: 'Alpine sandbox is not available.' };
    }

    try {
      const validActions = ['read', 'write', 'delete', 'list'];
      if (!validActions.includes(action)) {
        return { success: false, content: '', error: `Unknown action: ${action}. Valid: ${validActions.join(', ')}` };
      }

      switch (action) {
        case 'read': {
          const data = await SandboxService.readFile(filePath);
          return { success: true, content: data };
        }
        case 'write': {
          if (content === undefined) return { success: false, content: '', error: 'content is required for write action' };
          await SandboxService.writeFile(filePath, content);
          return { success: true, content: `Written to ${filePath}` };
        }
        case 'delete': {
          await SandboxService.delete(filePath);
          return { success: true, content: `Deleted ${filePath}` };
        }
        case 'list': {
          const entries = await SandboxService.list(filePath);
          const listing = entries.map(e => `${e.isDir ? '📁' : '📄'} ${e.name}${e.isDir ? '/' : ''} (${e.size} B)`).join('\n');
          return { success: true, content: listing || '(empty directory)' };
        }
        default:
          return { success: false, content: '', error: `Unhandled action: ${action}` };
      }
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const sandboxTools: Tool[] = [sandboxExec, sandboxInstall, sandboxClone, sandboxFS];
