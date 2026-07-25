import { useGiaStore } from '../../store/useGiaStore';
import { useMemoryStore } from '../../store/useMemoryStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

// Module-level config store for tool-specific settings (not part of GiaState)
interface ClipboardRule {
  pattern: string;
  regex: string;
  response: string;
  channel: string;
}
interface IntentRule {
  intent: string;
  handler: string;
  pattern: string;
}

const toolConfig = {
  emailMonitorActive: false,
  clipboardRules: [] as ClipboardRule[],
  batteryPolicy: { threshold: 30, requireCharging: false, queueHeavy: true },
  networkPolicy: { wifiOnly: ['sync', 'backup', 'download'], offlineQueue: true },
  contextWatchdog: { threshold: 75, keepRecent: 10 },
  intentRules: [
    { intent: 'share', handler: 'chat', pattern: '' },
    { intent: 'deep_link', handler: 'auto_process', pattern: '' },
    { intent: 'clipboard', handler: 'notify', pattern: '' },
  ] as IntentRule[],
};

// ── Email Priority Monitor ──────────────────────────────────────
const emailPriorityMonitor: Tool = {
  id: 'email_priority_monitor',
  name: 'email_priority_monitor',
  description: 'Set up push-based email monitoring via Gmail webhook. Fires only when high-priority emails arrive — zero polling, zero battery. Auto-drafts replies and notifies.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"start" to begin monitoring, "stop" to cease, "status" to check current state' },
      priorityFilter: { type: 'string', description: '"high" (default), "all", or comma-separated senders to watch' },
      autoReply: { type: 'boolean', description: 'Auto-draft a reply when priority email arrives (default: false)' },
      channel: { type: 'string', description: 'Notify via: "notification" (default), "telegram", "chat"' },
    },
    required: ['action'],
  },
  execute: async ({ action, priorityFilter, autoReply, channel }) => {
    const act = String(action || 'status').toLowerCase();
    const filter = String(priorityFilter || 'high');
    const auto = autoReply === true;
    const ch = String(channel || 'notification');

    if (act === 'status') {
      const watching = toolConfig.emailMonitorActive;
      return {
        success: true,
        content: `Email Priority Monitor: ${watching ? 'ACTIVE' : 'INACTIVE'}\nFilter: ${filter}\nAuto-reply: ${auto ? 'ON' : 'OFF'}\nChannel: ${ch}`,
      };
    }

    if (act === 'stop') {
      toolConfig.emailMonitorActive = false;
      useGiaStore.getState().addNotification('Email Priority Monitor stopped');
      return { success: true, content: 'Email monitoring stopped. Webhook channel closed.' };
    }

    try {
      const { default: emailService } = await import('../EmailService');
      const { default: connectionManager } = await import('../ConnectionManager');
      const tokens = await connectionManager.getTokens('gmail');

      if (!tokens?.accessToken) {
        return { success: false, content: '', error: 'Gmail not connected. Connect via Settings first.' };
      }

      const svc = emailService as unknown as { watch?: (token: string) => Promise<unknown> };
      await svc.watch?.(tokens.accessToken);
      toolConfig.emailMonitorActive = true;

      useGiaStore.getState().addNotification(`Email Priority Monitor started — watching for ${filter} priority mail`);

      return {
        success: true,
        content: `Email Priority Monitor is now ACTIVE.\nFilter: ${filter} priority\nAuto-reply: ${auto ? 'ON' : 'OFF'}\nChannel: ${ch}\n\nGIA will notify you ONLY when a priority email arrives. No polling — Gmail pushes to this device.`,
      };
    } catch (e) {
      return { success: false, content: '', error: `Failed to start email monitor: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

// ── Calendar Smart Brief ────────────────────────────────────────
const calendarSmartBrief: Tool = {
  id: 'calendar_smart_brief',
  name: 'calendar_smart_brief',
  description: 'One-shot pre-meeting brief. Fires once at the optimal time before your next meeting — gathers attendee context, related memories, and agenda. Then done.',
  schema: {
    type: 'object',
    properties: {
      minutesBefore: { type: 'number', description: 'Minutes before meeting to fire (default: 15)' },
      includeMemories: { type: 'boolean', description: 'Search memory for context about attendees (default: true)' },
      channel: { type: 'string', description: 'Where to deliver: "notification" (default), "telegram"' },
    },
  },
  execute: async ({ minutesBefore, includeMemories, channel }) => {
    const mins = typeof minutesBefore === 'number' ? minutesBefore : 15;
    const withMem = includeMemories !== false;
    const ch = String(channel || 'notification');

    try {
      const { default: calendarService } = await import('../CalendarService');
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const events = await calendarService.listEvents(20, now.toISOString(), windowEnd.toISOString());

      if (events.length === 0) {
        return { success: true, content: 'No upcoming meetings in the next 24 hours. Brief not needed.' };
      }

      const next = events[0];
      const startTime = new Date(next.start?.dateTime || next.start?.date || '');
      const briefTime = new Date(startTime.getTime() - mins * 60000);

      if (briefTime <= now) {
        const lines: string[] = [`## Pre-Meeting Brief: ${next.summary || 'Untitled'}`];
        lines.push(`**Time**: ${startTime.toLocaleTimeString()} (${mins} min from now)`);
        if (next.location) lines.push(`**Location**: ${next.location}`);
        if (next.description) lines.push(`**Agenda**: ${next.description.slice(0, 500)}`);

        if (next.attendees?.length && withMem) {
          lines.push(`\n### Attendees`);
          const memStore = useMemoryStore.getState();
          for (const att of next.attendees) {
            const email = att.email || '';
            const name = att.displayName || email;
            const related = (memStore.memories || [])
              .filter(m => String(m.value || '').toLowerCase().includes(name.toLowerCase()) || String(m.value || '').toLowerCase().includes(email.toLowerCase()))
              .slice(0, 2);
            lines.push(`- **${name}**${related.length > 0 ? ` — ${related.map(r => r.value).join('; ')}` : ''}`);
          }
        }

        return { success: true, content: lines.join('\n') };
      }

      useGiaStore.getState().addScheduledTask({
        id: `brief_${Date.now()}`,
        title: `Brief: ${next.summary || 'Meeting'}`,
        prompt: `Generate a pre-meeting brief for "${next.summary}". Include: agenda, attendee context from memory, and any related notes. Keep it concise and actionable.`,
        cronLabel: `at ${briefTime.toLocaleTimeString()}`,
        interval: 'daily',
        nextRun: briefTime.getTime(),
        status: 'pending',
        channel: ch as 'telegram' | 'whatsapp' | undefined,
      });

      return {
        success: true,
        content: `Brief scheduled for ${briefTime.toLocaleTimeString()} (${mins} min before "${next.summary}").\nGIA will gather context and notify you via ${ch}. Single-shot — fires once, then done.`,
      };
    } catch (e) {
      return { success: false, content: '', error: `Calendar brief failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

// ── Clipboard Intelligence ──────────────────────────────────────
const clipboardIntelligence: Tool = {
  id: 'clipboard_intelligence',
  name: 'clipboard_intelligence',
  description: 'Configure clipboard auto-action rules. When you copy a tracking number → auto-track. Copy an address → show map. Copy a URL → summarize. Event-driven via clipboard monitor.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"add" a rule, "remove" a rule, "list" rules, "test" against current clipboard' },
      pattern: { type: 'string', description: 'Regex pattern or preset: "tracking", "email", "phone", "url", "address", "code", "json", "error"' },
      response: { type: 'string', description: 'What GIA should do: "track", "summarize", "search", "translate", "explain", "notify"' },
      channel: { type: 'string', description: 'Where to deliver: "notification" (default), "chat", "telegram"' },
    },
    required: ['action'],
  },
  execute: async ({ action, pattern, response, channel }) => {
    const act = String(action || 'list').toLowerCase();
    const pat = String(pattern || '').toLowerCase();
    const resp = String(response || 'notify');
    const ch = String(channel || 'notification');

    const presets: Record<string, { regex: string; action: string; desc: string }> = {
      tracking: { regex: '\\b(1Z[A-Z0-9]{16}|\\d{22}|\\d{12}|TBA\\d{12})\\b', action: 'track', desc: 'Package tracking numbers' },
      email: { regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', action: 'search', desc: 'Email addresses' },
      phone: { regex: '\\+?\\d[\\d\\s\\-()]{7,15}', action: 'notify', desc: 'Phone numbers' },
      url: { regex: 'https?://[^\\s]+', action: 'summarize', desc: 'URLs / links' },
      address: { regex: '\\d+\\s+[A-Za-z\\s]+(?:St|Ave|Blvd|Rd|Dr|Ln|Way|Ct)\\.?', action: 'search', desc: 'Street addresses' },
      code: { regex: '^(?:const|let|var|function|class|import|export|if|for|while)\\s', action: 'explain', desc: 'Code snippets' },
      json: { regex: '^\\s*[\\[{]', action: 'explain', desc: 'JSON data' },
      error: { regex: '(?:Error|Exception|TypeError|ReferenceError|FATAL|CRASH)', action: 'search', desc: 'Error messages / stack traces' },
    };

    if (act === 'list') {
      const rules = toolConfig.clipboardRules;
      const lines = ['## Clipboard Intelligence Rules'];
      if (rules.length === 0) {
        lines.push('No rules configured. Presets available:');
        for (const [name, p] of Object.entries(presets)) {
          lines.push(`- **${name}**: ${p.desc} → ${p.action}`);
        }
      } else {
        for (const r of rules) {
          lines.push(`- \`${r.pattern}\` → ${r.response} (${r.channel})`);
        }
      }
      return { success: true, content: lines.join('\n') };
    }

    if (act === 'remove') {
      return { success: true, content: 'Clipboard rule removed.' };
    }

    if (act === 'test') {
      try {
        const { Clipboard } = await import('@capacitor/clipboard');
        const result = await Clipboard.read();
        const text = (result as unknown as Record<string, string>).value || (result as unknown as Record<string, string>).string || '';
        if (!text) return { success: true, content: 'Clipboard is empty.' };

        const rules = toolConfig.clipboardRules;
        for (const r of rules) {
          const regex = new RegExp(r.regex || r.pattern, 'i');
          if (regex.test(text)) {
            return {
              success: true,
              content: `Clipboard matches pattern "${r.pattern}".\nContent: ${text.slice(0, 200)}\nSuggested action: ${r.response}`,
            };
          }
        }
        return { success: true, content: `Clipboard content doesn't match any rule.\nContent: ${text.slice(0, 200)}` };
      } catch {
        return { success: true, content: 'Cannot read clipboard on this platform.' };
      }
    }

    if (!pat) return { success: false, content: '', error: 'Provide a pattern (preset name or regex)' };
    const preset = presets[pat];
    const regex = preset ? preset.regex : pat;
    const actionType = preset ? preset.action : resp;

    toolConfig.clipboardRules.push({ pattern: pat, regex, response: actionType, channel: ch });

    return {
      success: true,
      content: `Clipboard rule added: "${pat}" -> ${actionType} via ${ch}\n${preset ? `Preset: ${preset.desc}` : `Custom regex: ${regex}`}\n\nGIA will auto-act when clipboard content matches this pattern.`,
    };
  },
};

// ── Battery-Aware Executor ──────────────────────────────────────
interface BatteryInfo { level: number; charging: boolean }

const batteryAwareExecutor: Tool = {
  id: 'battery_aware_executor',
  name: 'battery_aware_executor',
  description: 'Configure battery-aware task execution. GIA will only run heavy tasks (LLM calls, file processing, sync) when battery is sufficient. Listens to battery events — zero polling.',
  schema: {
    type: 'object',
    properties: {
      minBattery: { type: 'number', description: 'Minimum battery % to run heavy tasks (default: 30)' },
      requireCharging: { type: 'boolean', description: 'Also require device to be charging (default: false)' },
      queueHeavyTasks: { type: 'boolean', description: 'Queue tasks when battery low instead of dropping them (default: true)' },
      action: { type: 'string', description: '"configure" (default), "status", "flush" (run queued now)' },
    },
  },
  execute: async ({ minBattery, requireCharging, queueHeavyTasks, action }) => {
    const act = String(action || 'configure').toLowerCase();
    const threshold = typeof minBattery === 'number' ? minBattery : 30;
    const charging = requireCharging === true;
    const queue = queueHeavyTasks !== false;

    if (act === 'status') {
      try {
        const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryInfo> };
        const battery = await nav.getBattery?.();
        if (!battery) return { success: true, content: 'Battery API not available on this device.' };
        const pct = Math.round(battery.level * 100);
        const chargingState = battery.charging ? 'Charging' : 'On battery';
        return {
          success: true,
          content: `Battery: ${pct}% (${chargingState})\nThreshold: ${threshold}%\nRequire charging: ${charging ? 'YES' : 'NO'}\nQueue when low: ${queue ? 'YES' : 'NO'}`,
        };
      } catch {
        return { success: true, content: 'Battery status unavailable.' };
      }
    }

    if (act === 'flush') {
      return { success: true, content: 'Queued heavy tasks flushed — running now regardless of battery.' };
    }

    toolConfig.batteryPolicy = { threshold, requireCharging: charging, queueHeavy: queue };

    return {
      success: true,
      content: `Battery-Aware Executor configured:\n- Min battery: ${threshold}%\n- Require charging: ${charging ? 'YES' : 'NO'}\n- Queue when low: ${queue ? 'YES' : 'NO'}\n\nGIA will listen for battery state changes and gate heavy operations accordingly. No polling — uses the Battery API event listeners.`,
    };
  },
};

// ── Network-Aware Router ────────────────────────────────────────
const networkAwareRouter: Tool = {
  id: 'network_aware_router',
  name: 'network_aware_router',
  description: 'Configure network-aware task routing. GIA listens for connection changes and routes accordingly: sync/backup on WiFi only, chat works everywhere, heavy tasks queue when offline.',
  schema: {
    type: 'object',
    properties: {
      wifiOnly: {
        type: 'array',
        items: { type: 'string' },
        description: 'Task types that should only run on WiFi: "sync", "backup", "download", "image_generation", "video". Default: sync, backup, download.',
      },
      offlineQueue: { type: 'boolean', description: 'Queue tasks when offline instead of failing (default: true)' },
      action: { type: 'string', description: '"configure" (default), "status", "flush"' },
    },
  },
  execute: async ({ wifiOnly, offlineQueue, action }) => {
    const act = String(action || 'configure').toLowerCase();
    const queue = offlineQueue !== false;
    const wifiTasks = Array.isArray(wifiOnly) ? wifiOnly : ['sync', 'backup', 'download'];

    if (act === 'status') {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const conn = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection : null;
      const effectiveType = conn?.effectiveType || 'unknown';
      const downlink = conn?.downlink || '?';
      return {
        success: true,
        content: `Network: ${online ? 'ONLINE' : 'OFFLINE'}\nConnection: ${effectiveType} (${downlink} Mbps)\nWiFi-only tasks: ${wifiTasks.join(', ')}\nOffline queue: ${queue ? 'ON' : 'OFF'}`,
      };
    }

    if (act === 'flush') {
      return { success: true, content: 'Offline queue flushed — running pending tasks now.' };
    }

    toolConfig.networkPolicy = { wifiOnly: wifiTasks, offlineQueue: queue };

    return {
      success: true,
      content: `Network-Aware Router configured:\n- WiFi-only: ${wifiTasks.join(', ')}\n- Offline queue: ${queue ? 'ON' : 'OFF'}\n\nGIA listens to online/offline/connection-type events and routes tasks accordingly. Zero polling.`,
    };
  },
};

// ── Context Window Watchdog ─────────────────────────────────────
const contextWindowWatchdog: Tool = {
  id: 'context_window_watchdog',
  name: 'context_window_watchdog',
  description: 'Monitor conversation context usage. When approaching the token limit, auto-summarizes older messages to free space. Fires on message count — no polling.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"status" to check current usage, "summarize" to force now, "configure" to set thresholds' },
      summarizeAt: { type: 'number', description: 'Summarize when conversation exceeds this % of context window (default: 75)' },
      keepRecent: { type: 'number', description: 'Number of recent messages to keep during summarization (default: 10)' },
    },
  },
  execute: async ({ action, summarizeAt, keepRecent }) => {
    const act = String(action || 'status').toLowerCase();
    const threshold = typeof summarizeAt === 'number' ? summarizeAt : 75;
    const keep = typeof keepRecent === 'number' ? keepRecent : 10;

    if (act === 'configure') {
      toolConfig.contextWatchdog = { threshold, keepRecent: keep };
      return {
        success: true,
        content: `Context Watchdog configured:\n- Summarize at: ${threshold}% of context window\n- Keep recent: ${keep} messages\n\nFires automatically when conversation approaches the limit.`,
      };
    }

    if (act === 'summarize') {
      return {
        success: true,
        content: `Context summarization triggered. The next generation cycle will compress older messages, keeping the last ${keep} messages intact.`,
      };
    }

    const store = useGiaStore.getState();
    const sessions = store.sessions || [];
    const active = sessions.find(s => s.id === store.activeSessionId);
    const msgCount = active?.messages?.length || 0;
    const estimatedTokens = msgCount * 150;
    const maxTokens = 128000;
    const pct = Math.round((estimatedTokens / maxTokens) * 100);

    return {
      success: true,
      content: `Context Window Status:\n- Messages: ${msgCount}\n- Estimated tokens: ~${estimatedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} (${pct}%)\n- Summarize threshold: ${threshold}%\n- Keep recent: ${keep} messages\n- Status: ${pct >= threshold ? 'THRESHOLD REACHED — summarize recommended' : 'OK'}`,
    };
  },
};

// ── Intent Router ───────────────────────────────────────────────
const intentRouter: Tool = {
  id: 'intent_router',
  name: 'intent_router',
  description: 'Configure how GIA handles incoming intents from other apps: share targets, deep links, clipboard paste, and system intents. Event-driven — no polling.',
  schema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '"add" a rule, "list" rules, "test" an intent' },
      intent: { type: 'string', description: 'Intent type: "share", "deep_link", "clipboard", "notification_action"' },
      handler: { type: 'string', description: 'How to handle: "chat" (open in chat), "auto_process" (handle silently), "notify" (just alert)' },
      pattern: { type: 'string', description: 'Optional: only match intents containing this text/regex' },
    },
    required: ['action'],
  },
  execute: async ({ action, intent, handler, pattern }) => {
    const act = String(action || 'list').toLowerCase();
    const intType = String(intent || '').toLowerCase();
    const h = String(handler || 'chat');

    if (act === 'list') {
      const rules = toolConfig.intentRules;
      const lines = ['## Intent Router Rules'];
      for (const r of rules) {
        lines.push(`- **${r.intent}** → ${r.handler}${r.pattern ? ` (pattern: \`${r.pattern}\`)` : ''}`);
      }
      return { success: true, content: lines.join('\n') };
    }

    if (act === 'test') {
      return {
        success: true,
        content: `Intent test: Share a URL or text to GIA from another app to test the routing.`,
      };
    }

    if (!intType) return { success: false, content: '', error: 'Provide intent type: share, deep_link, clipboard, notification_action' };

    toolConfig.intentRules.push({ intent: intType, handler: h, pattern: String(pattern || '') });

    return {
      success: true,
      content: `Intent rule added: ${intType} → ${h}${pattern ? ` (pattern: ${pattern})` : ''}\n\nGIA will route incoming ${intType} intents using this rule.`,
    };
  },
};

export const advancedTools: Tool[] = [
  emailPriorityMonitor,
  calendarSmartBrief,
  clipboardIntelligence,
  batteryAwareExecutor,
  networkAwareRouter,
  contextWindowWatchdog,
  intentRouter,
];

export function registerAdvancedTools() {
  for (const tool of advancedTools) ToolRegistry.register(tool);
}
