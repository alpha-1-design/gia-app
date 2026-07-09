import { useState, useRef, useCallback, useEffect } from 'react';
import GiaBrain from '../services/GiaBrain';
import TTSService from '../services/TTSService';
import { useGiaStore } from '../store/useGiaStore';
import { useAgentStore } from '../store/useAgentStore';
import { useProtocolStore } from '../store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';
import AnalyticsService from '../services/AnalyticsService';
import { genId } from '../utils/id';
import { autoSummarizeIfNeeded } from '../services/brain/contextManager';
import { processStreamForDisplay, processStreamChunk as sharedProcessStreamChunk, createStreamParser, flushThinkBlock, flushToolBlock } from '../utils/streamParser';
import { streamPush, streamCancel } from '../utils/streamThrottle';
import OutputValidator from '../services/OutputValidator';
import InputGuardrails from '../services/InputGuardrails';
import { LocalNotifications } from '@capacitor/local-notifications';
import { setToolMessageId } from '../services/brain/toolRunner';
import { giaCoreServices } from '../services/GIACoreServices';
import type { Message } from '../store/useGiaStore';
import { isNativePlatform } from '../utils/helpers';

const BACKGROUND_NOTIF_ID = 42;

async function notifyIfBackground(module: 'chat' | 'agents', sessionId: string, asstId: string): Promise<void> {
  const state = useGiaStore.getState();
  if (state.currentModule === module) return;
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const msg = session.messages.find(m => m.message.id === asstId)?.message;
  if (!msg?.content) return;
  const preview = msg.content.replace(/```[\s\S]*?```/g, '').trim().slice(0, 120);

  // Web desktop notification (works in browser)
  try {
    const { default: DesktopNotifications } = await import('../services/DesktopNotifications');
    DesktopNotifications.notify('GIA Response Ready', {
      body: preview || 'Your response has been generated.',
      tag: `gia-${module}-${asstId}`,
    });
  } catch { /* not critical */ }

  // Native Android notification (Capacitor)
  if (isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: BACKGROUND_NOTIF_ID + (module === 'agents' ? 100 : 0),
          title: 'GIA Response Ready',
          body: preview || 'Your response has been generated.',
          smallIcon: 'ic_stat_icon',
          extra: { sessionId, msgId: asstId },
        }],
      });
    } catch { /* not critical */ }
  }
}

export function useChatGeneration() {
  const [loading, setLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [streamingMsgIds, setStreamingMsgIds] = useState<Set<string>>(new Set());
  const [liveThoughts, setLiveThoughts] = useState<Record<string, string>>({});
  const activeStreamsRef = useRef<Set<string>>(new Set());

  // Sync streaming state with store generationState (survives module switches)
  useEffect(() => {
    const genState = useGiaStore.getState().generationState;
    if (genState.active && genState.module === 'chat' && genState.messageId && genState.sessionId) {
      setLoading(true);
      setStreamingMsgId(genState.messageId);
      setStreamingMsgIds(new Set([genState.messageId]));
      generationKeyRef.current = `chat-${genState.sessionId}-${genState.messageId}`;
    }
    const unsub = useGiaStore.subscribe((s) => {
      const gs = s.generationState;
      if (!gs.active || gs.module !== 'chat') {
        setLoading(false);
        setStreamingMsgId(null);
        setStreamingMsgIds(new Set());
        generationKeyRef.current = null;
      }
    });
    return unsub;
  }, []);

  const abortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseStartRef = useRef(0);
  const responseTimesRef = useRef<Record<string, number>>({});
  const lastUserMsgRef = useRef('');
  const generationKeyRef = useRef<string | null>(null);

  const { registerGenerationController, unregisterGenerationController, abortGeneration } = useGiaStore(useShallow(s => ({
    registerGenerationController: s.registerGenerationController,
    unregisterGenerationController: s.unregisterGenerationController,
    abortGeneration: s.abortGeneration,
  })));

  const handleStop = useCallback(() => {
    if (generationKeyRef.current) {
      abortGeneration(generationKeyRef.current);
      unregisterGenerationController(generationKeyRef.current);
    }
    TTSService.stop();
    const state = useGiaStore.getState();
    if (streamingMsgId && state.activeSessionId) {
      const session = state.sessions.find(s => s.id === state.activeSessionId);
      const ghost = session?.messages.find(m => m.message.id === streamingMsgId);
      if (ghost) {
        if (!ghost.message.content && ghost.message.thinking) {
          useGiaStore.setState({
            sessions: state.sessions.map(s =>
              s.id === state.activeSessionId
                ? { ...s, messages: s.messages.filter(m => m.message.id !== streamingMsgId), updatedAt: Date.now() }
                : s
            ),
          });
        } else {
          const finalContent = (ghost.message.content || '') + '\n\n*— Response stopped —*';
          state.updateMessage(state.activeSessionId, streamingMsgId, finalContent, ghost.message.thoughts);
        }
      }
    }
    setLoading(false);
    setStreamingMsgId(null);
    state.setIntentState('idle');
    state.setThinkingPhase('idle');
    generationKeyRef.current = null;
  }, [streamingMsgId, abortGeneration, unregisterGenerationController]);

  const handleSend = useCallback(async (
    input: string,
    attachments: { name: string; type: string; content?: string; preview?: string }[],
    setInput: (v: string) => void,
    setAttachments: (v: unknown[]) => void,
    agentInfo?: { id: string; name: string; icon: string; task?: string }[],
    cleanedInput?: string,
  ) => {
    if (input.trim().startsWith('/')) return;
    let text = (cleanedInput || input).trim();
    const sentAttachments = [...attachments];

    if (text.length > 12000) {
      const fileName = `long-input-${Date.now()}.txt`;
      sentAttachments.push({ name: fileName, type: 'text/plain', content: text });
      setAttachments(sentAttachments);
      text = 'I have attached a long text file for you to analyze.';
    }

    if (!text && sentAttachments.length === 0) return;

    const state = useGiaStore.getState();

    // ── InputGuardrails: check prompt safety ────────────────
    if (state.inputGuardrails) {
      try {
        const guard = await InputGuardrails.check(text);
        if (guard.risk === 'blocked') {
          state.addNotification(`🚫 Blocked: ${guard.reason}`);
          return;
        }
        if (guard.risk === 'suspicious') {
          state.addNotification(`⚠️ ${guard.reason}`);
          text = guard.sanitized;
        }
      } catch {
        state.addNotification('⚠️ Safety check failed, proceeding without guardrails');
      }
    }
    const { webSearch, extThinking, handsOff, localVision } = state;
    let sessionId = state.activeSessionId;
    if (!sessionId) sessionId = state.createSession();

    const fileNames = attachments.map(a => a.name).join(', ');
    const userContent = text || (fileNames ? `[Files: ${fileNames}]` : '');

    const userMsg: Message = {
      id: genId(), role: 'user', content: userContent, timestamp: Date.now(),
      attachments: sentAttachments.length > 0 ? sentAttachments as { name: string; type: string; content: string; preview?: string }[] : undefined,
      ...(agentInfo?.length === 1 ? { agentId: agentInfo[0].id, agentName: agentInfo[0].name, agentIcon: agentInfo[0].icon, agentTask: agentInfo[0].task || userContent } : {}),
    };

    // Auto-name session from first user message
    const session = state.sessions.find(s => s.id === sessionId);
    if (session && session.title === 'New Chat' && userContent) {
      const title = userContent.replace(/```[\s\S]*?```/g, '').trim().slice(0, 60);
      if (title) state.updateSessionTitle(sessionId, title.length >= 60 ? title + '…' : title);
    }

    state.addMessage(sessionId, userMsg);
    AnalyticsService.trackMessage('user');
    giaCoreServices.onMessage(userContent, userMsg.id, 'user');
    TTSService.stop();
    setInput('');
    setAttachments([]);
    lastUserMsgRef.current = text || fileNames;
    responseStartRef.current = Date.now();
    // Clear old tool execution results from previous turns
    useProtocolStore.getState().clearConsoleProtocols();
    if (!loading) setLoading(true);
    state.setIntentState('thinking');
    state.setThinkingPhase(webSearch ? 'searching' : 'reasoning');

    let prompt = text;
    if (sentAttachments.length > 0) {
      const maxFileLen = extThinking ? 150000 : 30000;
      const fileContext = sentAttachments
        .filter(a => !a.type.startsWith('image/'))
        .map(a => {
          const content = a.content || '';
          const truncated = content.length > maxFileLen;
          const body = truncated ? content.slice(0, maxFileLen) : content;
          const sizeNote = truncated
            ? `\n[NOTE: File truncated to ${(maxFileLen / 1000).toFixed(0)}K of ${(content.length / 1000).toFixed(0)}K total — use sub_agent_call to analyze remaining chunks]`
            : content.length > 30000
              ? `\n[NOTE: Full file included (${(content.length / 1000).toFixed(0)}K) — use sub_agent_call for parallel chunk analysis if needed]`
              : '';
          return `\n[BEGIN FILE: ${a.name}]${sizeNote}\n${body}\n[END FILE]`;
        })
        .join('\n\n');
      const imgContext = sentAttachments
        .filter(a => a.type.startsWith('image/'))
        .map(a => `[Image: ${a.name}]`)
        .join('\n');
      prompt = `${fileContext}\n\n${imgContext}\n\nUSER: ${text}`;
    }

    const runAgentTurn = async (agent?: { id: string; name: string; icon: string; task?: string }) => {
    const asstId = genId();
    activeStreamsRef.current.add(asstId);
    state.addMessage(sessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
      ...(agent ? { agentId: agent.id, agentName: agent.name, agentIcon: agent.icon, agentTask: agent.task || text } : {}),
    });
    setStreamingMsgId(asstId);
    setStreamingMsgIds(prev => new Set(prev).add(asstId));
    const genKey = `chat-${sessionId}-${asstId}`;
    generationKeyRef.current = genKey;
    const ctrl = new AbortController();
    registerGenerationController(genKey, ctrl);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId, messageId: asstId, abortSignal: ctrl.signal });

    let streamKey = '';
    try {
      const activeBranchId = state.getActiveSession()?.currentBranchId ?? '';
      const currentMsgs = sessionId ? state.getBranchMessages(sessionId, activeBranchId) : [];
      let history: { role: "user" | "assistant"; content: string }[] = currentMsgs
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Auto-summarize if context window is large and setting is enabled
      if (sessionId && history.length > 15 && useGiaStore.getState().localSummarize) {
        const branchId = state.getActiveSession()?.currentBranchId;
        if (branchId) {
          const result = await autoSummarizeIfNeeded(history, sessionId, branchId, (thought) => {
            useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
          });
          if (result.wasSummarized) {
            history = result.history as { role: "user" | "assistant"; content: string }[];
          }
        }
      }

      const brainImages = sentAttachments
        .filter(a => a.type.startsWith('image/') && a.preview)
        .map(a => ({ name: a.name, type: a.type, data: a.preview! }));

      state.setIntentState('responding');
      state.setThinkingPhase('writing');
      setToolMessageId(asstId);

      const handsOffPrefix = handsOff ? `[HANDS-OFF MODE: You have full control. Use built-in tools (web_search, filesystem_read, filesystem_write, terminal_run) freely.
To bundle files, respond with \`[GIA:zip:filename.zip]\` after outputting the file contents in \`[FILE:path] content [FILE]\` format.]\n\n` : '';

      const stateContext = `[SYSTEM: Current Feature State:
- Web Search: ${webSearch ? 'ON' : 'OFF'}
- Extended Thinking: ${extThinking ? 'ON' : 'OFF'}
- Hands-off Mode: ${handsOff ? 'ON' : 'OFF'}
- Local Vision: ${localVision ? 'ON' : 'OFF'}]\n\n`;

      // Resolve agent system prompt if routing to an agent
      let agentSystemPrompt: string | undefined;
      let systemPromptMode: 'append' | 'replace' | undefined;
      let agentPrompt = stateContext + handsOffPrefix + prompt;
      if (agent) {
        const agentDef = useAgentStore.getState().agents.find(a => a.id === agent.id);
        if (agentDef) {
          // Each mentioned agent gets its own instruction when one was given via
          // the @Name{task} picker, instead of silently sharing one blob of text
          // with every other mentioned agent.
          if (agent.task) {
            agentPrompt = stateContext + handsOffPrefix + agent.task;
          }
          agentSystemPrompt = `${agentDef.systemPrompt}\n\nYou are "${agentDef.name}" — embody this persona fully.\n${agentDef.description ? `Your purpose: ${agentDef.description}` : ''}\n\n## Thinking Protocol\nBefore you respond, reason step by step inside <think> tags. Show your chain of thought, analysis, and planning there. This is your internal reasoning — use it to think through the task before answering. After reasoning, provide your final response outside the tags.\n\n## Task Tracking\nBreak down your work into clear steps. Before each step, output a task marker on its own line like:\n---TASK: step description here\nThis helps track your progress. Start a new marker for each distinct step. The system will automatically mark previous steps as complete when you start a new one.\n\n## Honesty About Completion\nDo NOT claim a task is "done", "complete", or "finished" unless you actually called a tool that performed it and you can see a successful result in your own tool observations. If you did not call a tool for part of the task, say so explicitly (e.g. "I did not create the file — no filesystem tool was called") rather than describing the outcome as if it happened. A confident-sounding claim with no corresponding tool call is worse than admitting the step wasn't done.`;
          systemPromptMode = 'replace';
        }
      }

      const parserState = createStreamParser();
      let lastFlushedArtifactCount = 0;
      let displayAccumulated = '';
      streamKey = `${sessionId}:${asstId}`;
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: agentPrompt, history,
        systemPrompt: agentSystemPrompt,
        systemPromptMode,
        images: brainImages,
        localVision,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        temperature: extThinking ? undefined : 0.7,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, parserState);
          if (newDisplay) displayAccumulated += newDisplay;
          streamPush(streamKey, sessionId, asstId, displayAccumulated, parserState.thoughtsAccumulated || undefined, parserState.tasks.length > 0 ? parserState.tasks.map(t => ({ ...t })) : null, () => ctrl.signal.aborted);
          // Live artifact reveal: as soon as a code/artifact fence closes mid-stream,
          // push it to the panel immediately instead of waiting for the full response.
          if (parserState.artifacts.length > lastFlushedArtifactCount) {
            lastFlushedArtifactCount = parserState.artifacts.length;
            state.updateMessageArtifacts(sessionId, asstId, parserState.artifacts.slice());
          }
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          parserState.thoughtsAccumulated += (parserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: parserState.thoughtsAccumulated }));
          streamPush(streamKey, sessionId, asstId, displayAccumulated, parserState.thoughtsAccumulated, null, () => ctrl.signal.aborted);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
        }
      });

      if (ctrl.signal.aborted) return;

      // Flush any pending per-token timeouts so the final update isn't stale
      streamCancel(streamKey);

      // Flush partial blocks before finalising
      flushThinkBlock(parserState);
      flushToolBlock(parserState);

      if (res.text === '__CLARIFICATION__') {
        const stored = useGiaStore.getState().clarification;
        if (stored) {
          useGiaStore.setState({
            clarification: { ...stored, sessionId, assistantMsgId: asstId },
          });
          state.updateMessage(sessionId, asstId, displayAccumulated || processStreamForDisplay(parserState.accumulated), parserState.thoughtsAccumulated || undefined);
        }
        notifyIfBackground('chat', sessionId, asstId);
        state.setIntentState('idle');
        return;
      }

      let rawContent = processStreamForDisplay(parserState.accumulated) || displayAccumulated;
      // Wire OutputValidator into the streaming path to fix fence/JSON issues
      const validation = OutputValidator.validate(rawContent);
      if (validation.issues.length > 0 && validation.sanitized.length > 0) {
        rawContent = validation.sanitized;
      }
      const finalText = rawContent ||
        // If stream parser stripped everything (all tool blocks), use res.text with tool blocks removed
        (() => {
          const t = (res.text || '').replace(/```tool[\s\S]*?```/g, '').trim();
          const m = t.match(/<think>([\s\S]*?)<\/think>/);
          if (m) {
            parserState.thoughtsAccumulated = (parserState.thoughtsAccumulated || '') + '\n' + m[1].trim();
            return t.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          }
          return t;
        })() ||
        // Last resort: if everything is tool blocks, show raw to avoid blank message
        (res.text || '').trim().slice(0, 200) ||
        '🤖 _Taking action..._';
      state.updateMessage(sessionId, asstId, finalText, parserState.thoughtsAccumulated || undefined);
      if (parserState.artifacts.length > 0) {
        state.updateMessageArtifacts(sessionId, asstId, parserState.artifacts);
      }
      if (parserState.tasks.length > 0) {
        const finalTasks = parserState.tasks.map(t => ({
          ...t,
          status: t.status === 'in_progress' ? 'completed' as const : t.status,
        }));
        state.updateMessageTasks(sessionId, asstId, finalTasks);
      }
      giaCoreServices.onMessage(finalText, asstId, 'assistant');
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
            : sess
        ),
      }));
      if (res.sources?.length) {
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, sources: res.sources } } : m) }
              : s
          ),
        });
      }
      if (res.model || res.tokenUsage) {
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, model: res.model || m.message.model, tokenUsage: res.tokenUsage || m.message.tokenUsage } } : m) }
              : s
          ),
        });
      }
      if (res.modelSwitched && res.switchReason) {
        state.addNotification(res.switchReason);
      }
      notifyIfBackground('chat', sessionId, asstId);
    } catch (err: unknown) {
      streamCancel(streamKey);
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        state.updateMessage(sessionId, asstId, msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, error: true } } : m) }
              : s
          ),
        });
      }
    } finally {
      setToolMessageId(null);
      streamCancel(streamKey);
      setLiveThoughts(prev => { const n = {...prev}; delete n[asstId]; return n; });
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
            : sess
        ),
      }));
      activeStreamsRef.current.delete(asstId);
      setStreamingMsgIds(prev => { const n = new Set(prev); n.delete(asstId); return n; });
      if (activeStreamsRef.current.size === 0) {
        setLoading(false);
        setStreamingMsgId(null);
        useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
        useGiaStore.getState().setIntentState('idle');
        useGiaStore.getState().setThinkingPhase('idle');
      }
    }
    };

    // Multi-agent fan-out: every @mentioned agent runs as its own turn with its
    // own message, avatar and visible thoughts. No mention → a single GIA turn.
    const agentsToRun = agentInfo && agentInfo.length > 0 ? agentInfo : [undefined];
    await Promise.all(agentsToRun.map((a) => runAgentTurn(a)));
  }, [loading, registerGenerationController]);

  const handleContinue = useCallback(async (msgId: string) => {
    const state = useGiaStore.getState();
    const { webSearch } = state;
    if (!state.activeSessionId || loading) return;
    const activeBranchId = state.getActiveSession()?.currentBranchId ?? '';
    const msgs = state.getBranchMessages(state.activeSessionId, activeBranchId);
    const msgIndex = msgs.findIndex(m => m.id === msgId);
    if (msgIndex < 0) return;
    const lastContent = msgs[msgIndex]?.content || '';
    if (!lastContent) return;

    const asstId = genId();
    state.addMessage(state.activeSessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);
    setLoading(true);
    const genKey = `chat-continue-${state.activeSessionId}-${asstId}`;
    generationKeyRef.current = genKey;
    const ctrl = new AbortController();
    registerGenerationController(genKey, ctrl);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId: state.activeSessionId, messageId: asstId, abortSignal: ctrl.signal });
    state.setIntentState('thinking');
    state.setThinkingPhase(webSearch ? 'searching' : 'reasoning');

    let streamKey = '';
    try {
      let history: { role: "user" | "assistant"; content: string }[] = msgs.slice(0, msgIndex + 1)
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      if (state.activeSessionId && history.length > 15 && useGiaStore.getState().localSummarize) {
        const branchId = state.getActiveSession()?.currentBranchId;
        if (branchId) {
          const result = await autoSummarizeIfNeeded(history, state.activeSessionId, branchId, (thought) => {
            useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
          });
          if (result.wasSummarized) history = result.history as { role: "user" | "assistant"; content: string }[];
        }
      }

      const contParserState = createStreamParser();
      let contLastFlushedArtifactCount = 0;
      let contDisplayAccumulated = '';
      streamKey = `${state.activeSessionId!}:${asstId}`;
      state.setIntentState('responding');
      state.setThinkingPhase('writing');
      setToolMessageId(asstId);
      const contRes = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: 'Continue from where you left off. Do not repeat what was already said. Just continue naturally.',
        history: [...history, { role: 'assistant', content: lastContent }],
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, contParserState);
          if (newDisplay) contDisplayAccumulated += newDisplay;
          streamPush(streamKey, state.activeSessionId!, asstId, contDisplayAccumulated, contParserState.thoughtsAccumulated || undefined, null, () => ctrl.signal.aborted);
          if (contParserState.artifacts.length > contLastFlushedArtifactCount) {
            contLastFlushedArtifactCount = contParserState.artifacts.length;
            state.updateMessageArtifacts(state.activeSessionId!, asstId, contParserState.artifacts.slice());
          }
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          contParserState.thoughtsAccumulated += (contParserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: contParserState.thoughtsAccumulated }));
          streamPush(streamKey, state.activeSessionId!, asstId, contDisplayAccumulated, contParserState.thoughtsAccumulated, null, () => ctrl.signal.aborted);
        },
      });
      if (!ctrl.signal.aborted) {
        streamCancel(streamKey);
        flushThinkBlock(contParserState);
        flushToolBlock(contParserState);
        let contContent = processStreamForDisplay(contParserState.accumulated) || contDisplayAccumulated;
        const contValidation = OutputValidator.validate(contContent);
        if (contValidation.issues.length > 0 && contValidation.sanitized.length > 0) contContent = contValidation.sanitized;
        state.updateMessage(state.activeSessionId!, asstId, contContent, contParserState.thoughtsAccumulated || undefined);
        if (contParserState.artifacts.length > 0) {
          state.updateMessageArtifacts(state.activeSessionId!, asstId, contParserState.artifacts);
        }
        if (contRes.model || contRes.tokenUsage) {
          useGiaStore.setState({
            sessions: useGiaStore.getState().sessions.map(s =>
              s.id === state.activeSessionId
                ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, model: contRes.model || m.message.model, tokenUsage: contRes.tokenUsage || m.message.tokenUsage } } : m) }
                : s
            ),
          });
        }
        notifyIfBackground('chat', state.activeSessionId!, asstId);
      }
    } catch (err: unknown) {
      streamCancel(streamKey);
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        state.updateMessage(state.activeSessionId!, asstId, msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === state.activeSessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, error: true, thinking: false } } : m) }
              : s
          ),
        });
      }
      } finally {
      setToolMessageId(null);
      streamCancel(streamKey);
      if (generationKeyRef.current) {
        unregisterGenerationController(generationKeyRef.current);
        generationKeyRef.current = null;
      }
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess =>
          sess.id === state.activeSessionId
            ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
            : sess
        ),
      }));
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
      // Haptic feedback on response completion
      try {
        navigator.vibrate?.(15);
      } catch { /* not supported */ }
    }
  }, [loading, registerGenerationController, unregisterGenerationController]);

  const handleClarificationAnswer = useCallback(async (answer: string) => {
    const state = useGiaStore.getState();
    const clarification = state.clarification;
    if (!clarification) return;
    state.setClarification(null);

    const sessionId = clarification.sessionId || state.activeSessionId;
    if (!sessionId) return;

    state.addMessage(sessionId, {
      id: genId(), role: 'user', content: answer, timestamp: Date.now(),
    });

    const asstId = genId();
    state.addMessage(sessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);

    const genKey = `chat-clarify-${sessionId}-${asstId}`;
    generationKeyRef.current = genKey;
    const ctrl = new AbortController();
    registerGenerationController(genKey, ctrl);
    setLoading(true);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId, messageId: asstId, abortSignal: ctrl.signal });
    state.setIntentState('responding');

    let streamKey = '';
    try {
      const activeBranchId = state.getActiveSession()?.currentBranchId ?? '';
      const currentMsgs = state.getBranchMessages(sessionId, activeBranchId);
      const history: { role: "user" | "assistant"; content: string }[] = currentMsgs
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      const clarParserState = createStreamParser();
      let clarLastFlushedArtifactCount = 0;
      let clarDisplayAccumulated = '';
      streamKey = `${sessionId}:${asstId}`;
      setToolMessageId(asstId);
      await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: answer, history,
        useWebSearch: state.webSearch,
        useExtendedThinking: state.extThinking,
        temperature: state.extThinking ? undefined : 0.7,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, clarParserState);
          if (newDisplay) clarDisplayAccumulated += newDisplay;
          streamPush(streamKey, sessionId, asstId, clarDisplayAccumulated, clarParserState.thoughtsAccumulated || undefined, null, () => ctrl.signal.aborted);
          if (clarParserState.artifacts.length > clarLastFlushedArtifactCount) {
            clarLastFlushedArtifactCount = clarParserState.artifacts.length;
            state.updateMessageArtifacts(sessionId, asstId, clarParserState.artifacts.slice());
          }
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          clarParserState.thoughtsAccumulated += (clarParserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: clarParserState.thoughtsAccumulated }));
          streamPush(streamKey, sessionId, asstId, clarDisplayAccumulated, clarParserState.thoughtsAccumulated, null, () => ctrl.signal.aborted);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
          useGiaStore.setState({ showConsole: true });
        }
      });
      if (!ctrl.signal.aborted) {
        streamCancel(streamKey);
        flushThinkBlock(clarParserState);
        flushToolBlock(clarParserState);
        let clarContent = processStreamForDisplay(clarParserState.accumulated) || clarDisplayAccumulated;
        const clarValidation = OutputValidator.validate(clarContent);
        if (clarValidation.issues.length > 0 && clarValidation.sanitized.length > 0) clarContent = clarValidation.sanitized;
        state.updateMessage(sessionId, asstId, clarContent, clarParserState.thoughtsAccumulated || undefined);
        if (clarParserState.artifacts.length > 0) {
          state.updateMessageArtifacts(sessionId, asstId, clarParserState.artifacts);
        }
        notifyIfBackground('chat', sessionId, asstId);
      }
    } catch (err: unknown) {
      streamCancel(streamKey);
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        state.updateMessage(sessionId, asstId, msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, error: true } } : m) }
              : s
          ),
        });
      }
    } finally {
      setToolMessageId(null);
      streamCancel(streamKey);
      if (generationKeyRef.current) {
        unregisterGenerationController(generationKeyRef.current);
        generationKeyRef.current = null;
      }
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess =>
          sess.id === sessionId
            ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
            : sess
        ),
      }));
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, [registerGenerationController, unregisterGenerationController]);

  const handleRetry = useCallback(async (id: string) => {
    const state = useGiaStore.getState();
    const { webSearch, extThinking } = state;
    if (!state.activeSessionId) return;
    const activeBranchId = state.getActiveSession()?.currentBranchId ?? '';
    const msgs = state.getBranchMessages(state.activeSessionId, activeBranchId);
    const msgIndex = msgs.findIndex(m => m.id === id);
    if (msgIndex <= 0) return;
    const originalPrompt = msgs[msgIndex - 1]?.content || '';
    if (!originalPrompt) return;

    const genKey = `chat-retry-${state.activeSessionId}-${id}`;
    generationKeyRef.current = genKey;
    const ctrl = new AbortController();
    registerGenerationController(genKey, ctrl);

    state.updateMessage(state.activeSessionId, id, '');
    useGiaStore.setState({
      sessions: useGiaStore.getState().sessions.map(s =>
        s.id === state.activeSessionId
          ? { ...s, messages: s.messages.map(m => m.message.id === id ? { ...m, message: { ...m.message, thinking: true, error: false } } : m) }
          : s
      ),
    });
    setStreamingMsgId(id);
    setLoading(true);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId: state.activeSessionId, messageId: id });
    state.setIntentState('thinking');

    let streamKey = '';
    try {
      const history: { role: "user" | "assistant"; content: string }[] = msgs.slice(0, msgIndex - 1)
        .filter(m => !m.thinking && m.content)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      const retryParserState = createStreamParser();
      let retryLastFlushedArtifactCount = 0;
      let retryDisplayAccumulated = '';
      streamKey = `${state.activeSessionId!}:${id}`;
      state.setIntentState('responding');
      setToolMessageId(id);
      const genRes = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: originalPrompt, history,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, retryParserState);
          if (newDisplay) retryDisplayAccumulated += newDisplay;
          streamPush(streamKey, state.activeSessionId!, id, retryDisplayAccumulated, undefined, null, () => ctrl.signal.aborted);
          if (retryParserState.artifacts.length > retryLastFlushedArtifactCount) {
            retryLastFlushedArtifactCount = retryParserState.artifacts.length;
            state.updateMessageArtifacts(state.activeSessionId!, id, retryParserState.artifacts.slice());
          }
        },
      });
      if (!ctrl.signal.aborted) {
        streamCancel(streamKey);
        const retryFinal = retryDisplayAccumulated || processStreamForDisplay(retryParserState.accumulated);
        state.updateMessage(state.activeSessionId!, id, retryFinal);
        if (retryParserState.artifacts.length > 0) {
          state.updateMessageArtifacts(state.activeSessionId!, id, retryParserState.artifacts);
        }
        if (genRes.model || genRes.tokenUsage) {
          useGiaStore.setState({
            sessions: useGiaStore.getState().sessions.map(s =>
              s.id === state.activeSessionId
                ? { ...s, messages: s.messages.map(m => m.message.id === id ? { ...m, message: { ...m.message, model: genRes.model || m.message.model, tokenUsage: genRes.tokenUsage || m.message.tokenUsage } } : m) }
                : s
            ),
          });
        }
        if (genRes.modelSwitched && genRes.switchReason) {
          state.addNotification(`Model switched: ${genRes.switchReason}`);
        }
        TTSService.speak(retryParserState.accumulated);
        notifyIfBackground('chat', state.activeSessionId!, id);
      }
    } catch (e: unknown) {
      streamCancel(streamKey);
      if (!ctrl.signal.aborted) {
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === state.activeSessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === id ? { ...m, message: { ...m.message, content: (e instanceof Error ? e.message : 'Retry failed'), error: true, thinking: false } } : m) }
              : s
          ),
        });
      }
    } finally {
      setToolMessageId(null);
      streamCancel(streamKey);
      if (generationKeyRef.current) {
        unregisterGenerationController(generationKeyRef.current);
        generationKeyRef.current = null;
      }
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess =>
          sess.id === state.activeSessionId
            ? { ...sess, messages: sess.messages.map(m => m.message.id === id ? { ...m, message: { ...m.message, thinking: false } } : m) }
            : sess
        ),
      }));
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, [registerGenerationController, unregisterGenerationController]);

  return {
    loading, setLoading,
    streamingMsgId, setStreamingMsgId,
    streamingMsgIds, setStreamingMsgIds,
    liveThoughts, setLiveThoughts,
    abortTimeoutRef,
    responseStartRef, responseTimesRef, lastUserMsgRef,
    handleSend, handleContinue, handleClarificationAnswer,
    handleRetry, handleStop,
  };
}
