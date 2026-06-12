import terminalService from '../TerminalService';
import type { Tool } from './types';

const gatewayDaemonStart: Tool = {
  id: 'gateway_daemon_start',
  name: 'gateway_daemon_start',
  description: 'Start the GIA gateway daemon in the proot terminal. This enables 24/7 message listening on Telegram and other platforms.',
  schema: {
    type: 'object',
    properties: {
      background: { type: 'boolean', description: 'Run in background (default true). Set false to see live logs.' },
    },
  },
  execute: async (args) => {
    try {
      const status = await terminalService.getStatus();
      if (!status.running) {
        return { success: false, content: '', error: 'Proot terminal is not running. Start it first.' };
      }
      const bg = args?.background !== false;
      const cmd = 'cd ~/gia-app/daemon && node index.js' + (bg ? ' > /dev/null 2>&1 &' : '');
      const result = await terminalService.exec(cmd);
      if (result.exitCode === 0) {
        return {
          success: true,
          content: '## Gateway Daemon Started\n\nThe GIA gateway daemon is now running 24/7 in your proot+Alpine terminal.\n\nIt listens for messages on Telegram and routes them through GIA.\n\n**Manage it:**\n- Status: `ps aux | grep node`\n- Stop: `kill \$(pgrep -f "gia-app/daemon")`\n- Logs: `cat ~/.gia/gateway-daemon.log`',
        };
      }
      return { success: false, content: '', error: result.output || 'Failed to start daemon' };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to start gateway daemon' };
    }
  },
};

const gatewayDaemonStop: Tool = {
  id: 'gateway_daemon_stop',
  name: 'gateway_daemon_stop',
  description: 'Stop the running GIA gateway daemon.',
  execute: async () => {
    try {
      await terminalService.exec('pkill -f "gia-app/daemon" 2>/dev/null; echo "stopped"');
      return { success: true, content: 'Gateway daemon stopped.' };
    } catch (e) {
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Failed to stop daemon' };
    }
  },
};

const gatewayDaemonStatus: Tool = {
  id: 'gateway_daemon_status',
  name: 'gateway_daemon_status',
  description: 'Check if the gateway daemon is running.',
  execute: async () => {
    try {
      const result = await terminalService.exec('pgrep -f "gia-app/daemon" | head -1');
      const running = result.output?.trim() && result.exitCode === 0;
      if (running) {
        const pid = result.output.trim();
        const uptime = await terminalService.exec('ps -o etime= -p ' + pid + ' 2>/dev/null || echo unknown');
        return {
          success: true,
          content: '## Gateway Daemon Status\n\n**Status:** Running (PID ' + pid + ')\n**Uptime:** ' + (uptime.output?.trim() || 'unknown') + '\n\n**Logs:** `cat ~/.gia/gateway-daemon.log`',
        };
      }
      return {
        success: true,
        content: '## Gateway Daemon Status\n\n**Status:** Not running\n\nStart it: ask GIA "start the gateway daemon" or run `cd ~/gia-app/daemon && node index.js &`',
      };
    } catch {
      return { success: true, content: '## Gateway Daemon Status\n\n**Status:** Not running' };
    }
  },
};

const gatewayDaemonLogs: Tool = {
  id: 'gateway_daemon_logs',
  name: 'gateway_daemon_logs',
  description: 'Fetch recent logs from the gateway daemon.',
  execute: async () => {
    try {
      const result = await terminalService.exec('tail -50 ~/.gia/gateway-daemon.log 2>/dev/null || echo "No logs found"');
      const logs = result.output?.trim() || 'No logs found';
      return { success: true, content: '## Gateway Daemon Logs\n\n```\n' + logs.slice(0, 20000) + '\n```' };
    } catch {
      return { success: true, content: '## Gateway Daemon Logs\n\nNo logs found.' };
    }
  },
};

export const gatewayDaemonTools: Tool[] = [
  gatewayDaemonStart,
  gatewayDaemonStop,
  gatewayDaemonStatus,
  gatewayDaemonLogs,
];
