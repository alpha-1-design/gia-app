import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';

export type SlashCommandResult = {
  handled: boolean;
  message?: string;
  action?: 'clear' | 'compact' | 'mode-switch' | 'new-session' | 'show-skills' | 'show-help';
};

export type Giamode = 'code' | 'plan' | 'ask';

const COMMANDS: Record<string, { description: string; alias?: string[] }> = {
  help:     { description: 'Show all available commands', alias: ['?'] },
  clear:    { description: 'Clear current conversation', alias: ['cls'] },
  compact:  { description: 'Summarize & compress context window', alias: ['summarize'] },
  cost:     { description: 'Show token usage and estimated cost this session', alias: ['usage'] },
  tokens:   { description: 'Display current context window usage', alias: ['ctx'] },
  mode:     { description: 'Switch mode: /mode code|plan|ask', alias: [] },
  session:  { description: 'Start a new session', alias: ['new', 'reset'] },
  skills:   { description: 'Open the skills marketplace', alias: ['marketplace', 'store'] },
  status:   { description: 'Show provider, model, and feature status', alias: ['info'] },
  export:   { description: 'Export current chat as markdown', alias: [] },
  model:    { description: 'Switch model or show current model', alias: [] },
};

function countTokens(text: string): number {
  if (!text) return 0;
  // Rough approximation: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function estimateCost(inputTokens: number, outputTokens: number, model: string): string {
  // Rough cost estimates per 1M tokens (USD)
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  };
  const key = Object.keys(costs).find(k => model.includes(k)) || 'gpt-4o-mini';
  const c = costs[key];
  const cost = (inputTokens * c.input + outputTokens * c.output) / 1_000_000;
  return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(4)}`;
}

export function processSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return { handled: false };

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase().slice(1); // remove leading /
  const args = parts.slice(1);

  const state = useGiaStore.getState();

  switch (cmd) {
    case 'help':
    case '?': {
      const lines = Object.entries(COMMANDS).map(([name, info]) => {
        const aliases = info.alias?.length ? ` (${info.alias.join(', ')})` : '';
        return `\`/${name}\`${aliases} — ${info.description}`;
      });
      return {
        handled: true,
        message: `## Slash Commands\n\n${lines.join('\n')}\n\n_Type any command to execute it._`,
      };
    }

    case 'clear':
    case 'cls': {
      if (state.activeSessionId) {
        state.clearSession(state.activeSessionId);
      }
      return { handled: true, message: '🗑️ Conversation cleared.', action: 'clear' };
    }

    case 'compact':
    case 'summarize': {
      return {
        handled: true,
        message: '📦 Context compacted — summarized conversation history.',
        action: 'compact',
      };
    }

    case 'cost':
    case 'usage': {
      const session = state.getActiveSession();
      if (!session) return { handled: true, message: 'No active session.' };

      let totalInput = 0;
      let totalOutput = 0;
      let msgCount = 0;
      let toolCalls = 0;

      function walk(nodes: import('../store/useGiaStore').MessageNode[]) {
        for (const node of nodes) {
          const m = node.message;
          if (m.tokenUsage) {
            totalInput += m.tokenUsage.input;
            totalOutput += m.tokenUsage.output;
          }
          msgCount++;
          if (m.content?.includes('```tool')) toolCalls++;
          walk(node.children);
        }
      }
      walk(session.messages);

      const { activeProvider, providers } = useProviderStore.getState();
      const model = providers[activeProvider]?.model || 'unknown';
      const totalTokens = totalInput + totalOutput;
      const cost = estimateCost(totalInput, totalOutput, model);

      return {
        handled: true,
        message: [
          '## Session Usage',
          '',
          `**Messages:** ${msgCount}`,
          `**Tool calls:** ${toolCalls}`,
          `**Input tokens:** ${totalInput.toLocaleString()}`,
          `**Output tokens:** ${totalOutput.toLocaleString()}`,
          `**Total tokens:** ${totalTokens.toLocaleString()}`,
          `**Model:** ${model}`,
          `**Estimated cost:** ${cost}`,
        ].join('\n'),
      };
    }

    case 'tokens':
    case 'ctx': {
      const session = state.getActiveSession();
      if (!session) return { handled: true, message: 'No active session.' };

      let contextChars = 0;
      let messageCount = 0;
      function walk(nodes: import('../store/useGiaStore').MessageNode[]) {
        for (const node of nodes) {
          const m = node.message;
          if (!m.thinking && m.content) {
            contextChars += m.content.length;
          }
          messageCount++;
          walk(node.children);
        }
      }
      walk(session.messages);

      const tokens = countTokens(session.messages.map(n => n.message.content || '').join(''));
      const maxContext = 128000; // typical max
      const pct = Math.round((tokens / maxContext) * 100);

      return {
        handled: true,
        message: [
          '## Context Window',
          '',
          `**Messages:** ${messageCount}`,
          `**Characters:** ${contextChars.toLocaleString()}`,
          `**Estimated tokens:** ~${tokens.toLocaleString()}`,
          `**Context used:** ${pct}% of ${maxContext.toLocaleString()}`,
          `**Bar:** ${'█'.repeat(Math.min(20, Math.round(pct / 5)))}${'░'.repeat(20 - Math.min(20, Math.round(pct / 5)))} ${pct}%`,
        ].join('\n'),
      };
    }

    case 'mode': {
      const mode = (args[0] || '').toLowerCase() as Giamode;
      if (!['code', 'plan', 'ask'].includes(mode)) {
        return {
          handled: true,
          message: `Current mode: **${state.sharedData['gia-mode'] || 'code'}**\n\nUsage: \`/mode code\`, \`/mode plan\`, or \`/mode ask\``,
        };
      }
      useGiaStore.setState({ sharedData: { ...state.sharedData, 'gia-mode': mode } });
      const modeDescriptions: Record<string, string> = {
        code: '🔧 **Code Mode** — GIA reads, writes, and executes code freely.',
        plan: '📋 **Plan Mode** — GIA generates plans without making changes. Edits blocked until approval.',
        ask: '💬 **Ask Mode** — GIA answers questions only. No file modifications.',
      };
      return { handled: true, message: modeDescriptions[mode], action: 'mode-switch' };
    }

    case 'session':
    case 'new':
    case 'reset': {
      state.createSession();
      return { handled: true, message: '✨ New session started.', action: 'new-session' };
    }

    case 'skills':
    case 'marketplace':
    case 'store': {
      return { handled: true, message: '🏪 Opening skills marketplace...', action: 'show-skills' };
    }

    case 'status':
    case 'info': {
      const { activeProvider, providers } = useProviderStore.getState();
      const cfg = providers[activeProvider];
      const features = [];
      if (state.webSearch) features.push('🔍 Web Search');
      if (state.extThinking) features.push('🧠 Extended Thinking');
      if (state.handsOff) features.push('⚡ Hands-Off');
      if (state.localVision) features.push('👁️ Local Vision');
      if (state.multiProvider) features.push('🤝 Multi-Provider');
      if (state.smartFallback) features.push('🔄 Smart Fallback');
      if (state.hapticFeedback) features.push('📳 Haptic');

      return {
        handled: true,
        message: [
          '## GIA Status',
          '',
          `**Provider:** ${activeProvider} ${cfg?.enabled ? '✅' : '❌'}`,
          `**Model:** ${cfg?.model || 'none'}`,
          `**Mode:** ${(state.sharedData['gia-mode'] as string) || 'code'}`,
          `**Active skill:** ${state.activeSkillId || 'none'}`,
          '',
          '**Active Features:**',
          features.length > 0 ? features.map(f => `- ${f}`).join('\n') : '- None',
          '',
          `**Sessions:** ${state.sessions.length}`,
          `**Console logs:** ${state.consoleLogs.length}`,
        ].join('\n'),
      };
    }

    case 'export': {
      const session = state.getActiveSession();
      if (!session) return { handled: true, message: 'No active session to export.' };

      const lines: string[] = [`# ${session.title}\n`];
      function walk(nodes: import('../store/useGiaStore').MessageNode[]) {
        for (const node of nodes) {
          const m = node.message;
          if (m.thinking) { walk(node.children); continue; }
          const role = m.role === 'user' ? '**You**' : '**GIA**';
          lines.push(`### ${role}\n\n${m.content}\n`);
          walk(node.children);
        }
      }
      walk(session.messages);

      // Copy to clipboard
      const md = lines.join('\n');
      navigator.clipboard?.writeText(md).catch(() => {});
      return { handled: true, message: `📋 Chat exported to clipboard (${md.length} chars).` };
    }

    case 'model': {
      const { activeProvider, providers } = useProviderStore.getState();
      const model = args.join(' ');
      if (!model) {
        return {
          handled: true,
          message: `**Current model:** ${providers[activeProvider]?.model || 'none'}`,
        };
      }
      useProviderStore.getState().setProviderModel(activeProvider, model);
      return { handled: true, message: `✅ Model switched to **${model}**` };
    }

    default:
      return {
        handled: true,
        message: `Unknown command: \`${cmd}\`\n\nType \`/help\` for available commands.`,
      };
  }
}

export function getCommandList(): string[] {
  return Object.keys(COMMANDS);
}

export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
}
