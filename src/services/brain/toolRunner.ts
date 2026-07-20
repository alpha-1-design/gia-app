import GiaTools, { ToolResult } from '../GiaTools';
import { useProtocolStore } from '../../store/useProtocolStore';
import { useGiaStore } from '../../store/useGiaStore';
import { useSearchActivity } from '../../store/useSearchActivity';
import { ProtocolProposal } from '../../types/protocol';
import { validateToolArgs, toolToProtocolType, toolToImpact } from './toolSchemas';
import { delegateTask } from './subAgent';
import { SubAgentManager } from './SubAgentManager';
import { extractToolCalls, ToolCall } from '../../utils/jsonRepair';
import AnalyticsService from '../AnalyticsService';
import AnalyticsTracker from '../AnalyticsTracker';
import { toolRateLimiter, globalToolLimiter } from '../ToolRateLimiter';

interface ExecutionState {
  history: { role: string; content: string }[];
  currentPrompt: string;
  clarificationAttempts: number;
}

type ThoughtFn = (msg: string) => void;

const FALLBACK_HINTS: Record<string, string> = {
  web_search: 'read_url',
  read_url: 'web_search',
  filesystem_read: 'filesystem_write',
  filesystem_write: 'filesystem_read',
  list_files: 'filesystem_read',
  terminal_run: 'Try bash to install needed packages (pip/npm/apt), then retry. Or switch language.',
  image_generation: 'web_search',
  github: 'web_search or read_url',
  search_places: 'web_search',
  browser_navigate: 'read_url',
  zip_project: 'Try filesystem_write as individual files',
  send_sms: 'Try send_whatsapp or send_email as an alternative',
  set_alarm: 'Ask the user to set the alarm manually, or set a reminder via send_email',
  send_whatsapp: 'Try send_sms or send_email instead',
  send_email: 'Try send_whatsapp or send_sms instead',
  make_phone_call: 'Ask the user to place the call manually',
  share: 'Try clipboard instead, or ask the user to share manually',
  clipboard: 'Ask the user to copy/paste manually',
  vibrate: 'Skip vibration and proceed silently',
  screen_brightness: 'Ask the user to adjust brightness manually',
  device_info: 'Ask the user about their device specifications',
  get_contacts: 'Ask the user for the contact details directly',
  open_url: 'Share the URL via clipboard, send_email, or send_whatsapp instead',
};

const PARALLEL_SAFE_TOOLS = new Set([
  'web_search', 'read_url', 'browser_navigate', 'page_info',
  'filesystem_read', 'list_files',
  'get_environment_info', 'get_user_location', 'search_places',
  'task_read', 'note_read',
  'wikipedia', 'weather', 'define',
  'social_list_platforms', 'social_list_posts', 'social_analytics',
  'social_connect', 'social_disconnect',
  'connector_list', 'connector_test',
  'gateway_list', 'gateway_stats', 'gateway_logs',
  'telegram_status', 'telegram_channel_info', 'telegram_stats',
  'email_list', 'email_read', 'email_search', 'email_status',
  'calendar_list_events', 'calendar_status',
  'messaging_status',
  'bible_verse', 'daily_devotion',
]);

function getIndependentGroups(toolCalls: ToolCall[]): ToolCall[][] {
  const groups: ToolCall[][] = [];
  let currentGroup: ToolCall[] = [];
  let subAgentGroup: ToolCall[] = [];

  for (const call of toolCalls) {
    if (call.id === 'sub_agent_call') {
      subAgentGroup.push(call);
    } else if (call.id === 'request_clarification') {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([call]);
    } else if (PARALLEL_SAFE_TOOLS.has(call.id)) {
      if (subAgentGroup.length > 0) {
        groups.push(subAgentGroup);
        subAgentGroup = [];
      }
      currentGroup.push(call);
    } else {
      if (subAgentGroup.length > 0) {
        groups.push(subAgentGroup);
        subAgentGroup = [];
      }
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([call]);
    }
  }
  if (subAgentGroup.length > 0) groups.push(subAgentGroup);
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}

async function executeSingleTool(
  toolCall: ToolCall,
  text: string,
  state: ExecutionState,
  onThought?: ThoughtFn,
  signal?: AbortSignal,
  sourcesAcc?: string[],
  messageId?: string,
): Promise<{ result?: string; observations: string[] }> {
  const observations: string[] = [];

  // Rate limiting: check per-tool and global limits
  if (!toolRateLimiter.consume(toolCall.id)) {
    observations.push(`RATE LIMITED: ${toolCall.id} — too many calls per minute. Try a different approach or wait.`);
    return { result: 'rate_limited', observations };
  }
  if (!globalToolLimiter.consume('global')) {
    observations.push('RATE LIMITED: Too many tool calls overall per minute. Slow down.');
    return { result: 'rate_limited', observations };
  }

  if (toolCall.id === 'sub_agent_call') {
    const { provider, prompt: subPrompt, agent } = toolCall.args as { provider: string; prompt: string; agent?: string };
    onThought?.(agent ? `Delegating to sub-agent (${provider}) as ${agent}...` : `Delegating to sub-agent (${provider})...`);
    const subRes = await delegateTask(provider, subPrompt, signal, agent);
    observations.push(`SUB-AGENT (${provider}): ${subRes}`);
    return { observations };
  }

  if (toolCall.id === 'request_clarification') {
    if (state.clarificationAttempts >= 1) {
      observations.push('OBSERVATION: Clarification already asked. Respond directly without asking again.');
      return { result: 'skip', observations };
    }
    state.clarificationAttempts++;
    const tool = GiaTools.getTool('request_clarification');
    if (tool) {
      await tool.execute(toolCall.args);
      return { result: '__CLARIFICATION__', observations };
    }
    return { observations };
  }

  const tool = GiaTools.getTool(toolCall.id);
  if (!tool) return { observations };

  const validationError = validateToolArgs(toolCall.id, toolCall.args);
  if (validationError) {
    observations.push(`VALIDATION ERROR: ${validationError}. Please fix and retry.`);
    return { result: 'validation_error', observations };
  }

  const protocolId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const protocol: ProtocolProposal = {
    id: protocolId,
    type: toolToProtocolType(toolCall.id),
    summary: tool.name,
    description: `Execute ${tool.name} with provided arguments`,
    args: toolCall.args,
    impact: toolToImpact(toolCall.id),
    state: 'proposed',
    createdAt: Date.now(),
    trace: [],
    messageId,
  };
  useProtocolStore.getState().propose(protocol);

  const argsStr = Object.entries(toolCall.args || {}).map(([k, v]) => {
    const s = String(v);
    return `${k}: ${s.length > 80 ? s.slice(0, 80) + '…' : s}`;
  }).join(', ');
  onThought?.(`🧠 ${tool.name} → ${argsStr}`);

  const needsConfirm = !useProtocolStore.getState().isAutoConfirmed(protocol.type);
  if (needsConfirm) {
    const action = await useProtocolStore.getState().waitForConfirmation(protocolId, 30_000);
    if (action.type === 'reject') {
      observations.push(`User rejected tool execution: ${toolCall.id}`);
      useProtocolStore.getState().setFailed(protocolId, 'Rejected by user');
      return { result: 'rejected', observations };
    }
    if (action.type === 'modify' && action.modifiedArgs) {
      toolCall.args = action.modifiedArgs;
    }
  }

  useProtocolStore.getState().setExecuting(protocolId);
  onThought?.(`⚡ Executing: ${tool.name}...`);
  useGiaStore.getState().setCurrentTool(toolCall.id);

  // Emit live search activity event before execution starts
  const isWebTool = ['web_search', 'read_url', 'browser_navigate'].includes(toolCall.id);
  if (isWebTool) {
    const sa = useSearchActivity.getState();
    sa.setPanelOpen(true);
    if (toolCall.id === 'web_search') {
      sa.addEvent({ type: 'query', message: (toolCall.args.query as string) || '', done: false });
    } else {
      const u = (toolCall.args.url as string) || '';
      sa.addEvent({ type: 'fetch', message: u, url: u, done: false });
    }
  }

  const execStartTime = performance.now();
  let result: ToolResult;
  let toolAttempts = 0;
  const maxToolAttempts = 3;

  const toolContext = {
    signal,
    onProgress: (progress: number, label: string) => {
      useProtocolStore.getState().setProgress(protocolId, progress, label);
    },
    onThought: (thought: string) => {
      onThought?.(`  · ${thought}`);
    },
  };

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      result = await tool.execute(toolCall.args, toolContext);
    } catch (e: unknown) {
      result = { success: false, content: '', error: e instanceof Error ? e.message : 'Unknown error' };
    }
    // Don't retry permanent failures: validation errors, auth errors, "not found", parse errors
    const errorMsg = result!.error || '';
    const isPermanent = /validation|auth|not found|permission|invalid|parse|syntax/i.test(errorMsg);
    if (result.success || isPermanent || toolAttempts >= maxToolAttempts - 1) break;
    toolAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, toolAttempts), 8000);
    onThought?.(`⚠️ ${tool.name} attempt ${toolAttempts} failed — retrying in ${backoff}ms...`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, backoff);
      if (signal) {
        const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
  useGiaStore.getState().setCurrentTool(null);
  AnalyticsService.trackTool(toolCall.id, result!.success);
  AnalyticsTracker.trackToolExecuted(toolCall.id, result!.success, Math.round(performance.now() - execStartTime), result!.error);

  const hint = FALLBACK_HINTS[toolCall.id];
  const obs = result!.success
    ? `OBSERVATION: Success\n${result!.content}`
    : `TOOL FAILED: ${toolCall.id} — ${result!.error || 'Unknown error'}. ${hint ? `Try using '${hint}' instead or use a completely different approach.` : 'Use a different approach or tool to achieve the same goal.'} If no alternative works, inform the user about the failure and suggest next steps.`;
  onThought?.(result!.success ? obs : `⚠️ ${toolCall.id} failed — trying alternative...`);

  if (result!.success) {
    useProtocolStore.getState().setCompleted(protocolId, result!.content, result!.sources);
    if (sourcesAcc && result!.sources?.length) {
      for (const s of result!.sources) {
        if (!sourcesAcc.includes(s.url)) sourcesAcc.push(s.url);
      }
    }
    // Complete search activity events (started before execution)
    if (isWebTool) {
      const sa = useSearchActivity.getState();
      const msg = toolCall.id === 'web_search'
        ? (toolCall.args.query as string) || ''
        : (toolCall.args.url as string) || '';
      sa.completeEvent(msg);
      if (toolCall.id === 'web_search') {
        sa.addEvent({ type: 'info', message: `Found ${result!.sources?.length || 0} results`, done: true });
        result!.sources?.forEach(s => sa.addSource({ title: s.title, url: s.url, snippet: '', source: 'web' }));
      } else {
        if (result!.sources?.length) {
          result!.sources.forEach(s => sa.addSource({ title: s.title, url: s.url, snippet: '', source: 'web' }));
        } else {
          sa.addSource({ title: (toolCall.args.url as string) || '', url: (toolCall.args.url as string) || '', snippet: '', source: 'web' });
        }
      }
    }
  } else {
    useProtocolStore.getState().setFailed(protocolId, result!.error || 'Unknown error');
  }

  observations.push(obs);
  useGiaStore.getState().addConsoleLog({
    type: result!.success ? 'tool' : 'error',
    content: `Tool: ${toolCall.id}\nResult: ${result!.content.slice(0, 500)}`,
  });

  return { observations };
}

export async function executeToolBlocks(
  text: string,
  state: ExecutionState,
  onThought?: ThoughtFn,
  signal?: AbortSignal,
  sourcesAcc?: string[],
  messageId?: string,
): Promise<{ didExecute: boolean; result?: string }> {
  const toolCalls = extractToolCalls(text);
  if (!toolCalls.length) return { didExecute: false };

  const isGodMode = useGiaStore.getState().extThinking;

  // Track claimed tools
  for (const tc of toolCalls) {
    AnalyticsTracker.trackToolClaimed(tc.id);
  }

  const groups = getIndependentGroups(toolCalls);
  const allObservations: string[] = [];

  for (const group of groups) {
    if (signal?.aborted) break;

    // Sub-agent batch — run all in parallel via SubAgentManager
    if (group.length > 0 && group[0].id === 'sub_agent_call') {
      const manager = new SubAgentManager(isGodMode ? 8 : 5, isGodMode);
      // Note: SubAgentManager selects its own personas (AGENT_ROLES, keyword-matched
      // or role-assigned per identity) rather than using the caller-specified `agent`
      // param — that param is only meaningful for single delegateTask() calls outside
      // a batch. See SubAgentManager.executeOne, which now passes identity.name through.
      const tasks = group.map((call) => ({
        provider: (call.args.provider as string) || 'openai',
        prompt: (call.args.prompt as string) || '',
      }));
      onThought?.(`Spawning ${group.length} sub-agents in parallel${isGodMode ? ' [GOD MODE]' : ''}...`);
      await manager.runAll(tasks, signal);
      const results = manager.synthesize();
      manager.markFinished();
      allObservations.push(`SUB-AGENT RESULTS:\n${results}`);
      state.history.push({ role: 'assistant', content: text });
      state.history.push({ role: 'user', content: allObservations.join('\n') });
      state.currentPrompt = `Sub-agents completed. Use their findings to respond.`;
      return { didExecute: true };
    }

    if (group.length === 1) {
      const call = group[0];
      try {
        const { result, observations } = await executeSingleTool(call, text, state, onThought, signal, sourcesAcc, messageId);
        allObservations.push(...observations);
        if (result === '__CLARIFICATION__') {
          const cleanText = text.replace(/```tool\n[\s\S]*?\n```/g, '').trim();
          state.history.push({ role: 'assistant', content: cleanText || 'I need some clarification.' });
          return { didExecute: true, result: '__CLARIFICATION__' };
        }
        if (result === 'rejected') {
          state.history.push({ role: 'assistant', content: text });
          state.history.push({ role: 'user', content: `User rejected tool execution: ${call.id}` });
          state.currentPrompt = `User rejected the tool. Please respond without using it.`;
          return { didExecute: true };
        }
      } catch (e: unknown) {
        state.history.push({ role: 'assistant', content: text });
        state.history.push({ role: 'user', content: `ERROR parsing tool call: ${e instanceof Error ? e.message : 'Unknown error'}` });
        state.currentPrompt = `Tool call was malformed. Please fix JSON and try again.`;
        return { didExecute: true, result: 'malformed_json' };
      }
    } else {
      // Parallel execution for independent tools
      try {
        onThought?.(`⚡ Running ${group.length} tools in parallel...`);
        const results = await Promise.all(
          group.map((call) => executeSingleTool(call, text, state, onThought, signal, sourcesAcc, messageId))
        );

        for (const { result, observations } of results) {
          allObservations.push(...observations);
          if (result === '__CLARIFICATION__') {
            const cleanText = text.replace(/```tool\n[\s\S]*?\n```/g, '').trim();
            state.history.push({ role: 'assistant', content: cleanText || 'I need some clarification.' });
            return { didExecute: true, result: '__CLARIFICATION__' };
          }
          if (result === 'rejected') {
            state.history.push({ role: 'assistant', content: text });
            state.history.push({ role: 'user', content: `User rejected tool execution: ${group.map((c) => c.id).join(', ')}` });
            state.currentPrompt = `User rejected the tool. Please respond without using it.`;
            return { didExecute: true };
          }
        }
        onThought?.(`✅ ${group.length} parallel tools completed`);
      } catch (e: unknown) {
        state.history.push({ role: 'assistant', content: text });
        state.history.push({ role: 'user', content: `ERROR in parallel execution: ${e instanceof Error ? e.message : 'Unknown error'}` });
        state.currentPrompt = `Tool execution error. Please try a different approach.`;
        return { didExecute: true, result: 'parallel_error' };
      }
    }
  }

  if (allObservations.length > 0) {
    state.history.push({ role: 'assistant', content: text });
    state.history.push({ role: 'user', content: allObservations.join('\n') });
    state.currentPrompt = `Tool(s) finished. ${allObservations.every(o => o.startsWith('OBSERVATION: Success')) ? 'Proceed.' : 'Some failed. Try fallback or different approach. Keep going.'}`;
    return { didExecute: true };
  }

  return { didExecute: false };
}
