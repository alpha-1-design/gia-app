import { useState, useRef, useCallback } from 'react';
import GiaBrain from '../services/GiaBrain';
import TTSService from '../services/TTSService';
import { useGiaStore } from '../store/useGiaStore';
import { useProtocolStore } from '../store/useProtocolStore';
import AnalyticsService from '../services/AnalyticsService';
import { genId } from '../utils/id';
import { autoSummarizeIfNeeded } from '../services/brain/contextManager';
import { processStreamForDisplay, processStreamChunk as sharedProcessStreamChunk, createStreamParser, flushThinkBlock } from '../utils/streamParser';
import InputGuardrails from '../services/InputGuardrails';
import { LocalNotifications } from '@capacitor/local-notifications';
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
  const [liveThoughts, setLiveThoughts] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);
  const abortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const responseStartRef = useRef(0);
  const responseTimesRef = useRef<Record<string, number>>({});
  const lastUserMsgRef = useRef('');

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
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
  }, [streamingMsgId]);

  const handleSend = useCallback(async (
    input: string,
    attachments: { name: string; type: string; content?: string; preview?: string }[],
    setInput: (v: string) => void,
    setAttachments: (v: unknown[]) => void,
  ) => {
    if (input.trim().startsWith('/')) return;
    let text = input.trim();
    if (text.length > 12000) {
      const fileName = `long-input-${Date.now()}.txt`;
      setAttachments([...attachments, { name: fileName, type: 'text/plain', content: text }]);
      text = 'I have attached a long text file for you to analyze.';
    }

    if ((!text && attachments.length === 0) || loading) return;

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
      attachments: attachments.length > 0 ? attachments as { name: string; type: string; content: string; preview?: string }[] : undefined,
    };

    // Auto-name session from first user message
    const session = state.sessions.find(s => s.id === sessionId);
    if (session && session.title === 'New Chat' && userContent) {
      const title = userContent.replace(/```[\s\S]*?```/g, '').trim().slice(0, 60);
      if (title) state.updateSessionTitle(sessionId, title.length >= 60 ? title + '…' : title);
    }

    state.addMessage(sessionId, userMsg);
    AnalyticsService.trackMessage('user');
    TTSService.stop();
    const sentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    lastUserMsgRef.current = text || fileNames;
    responseStartRef.current = Date.now();
    // Clear old tool execution results from previous turns
    useProtocolStore.getState().clearConsoleProtocols();
    setLoading(true);
    state.setIntentState('thinking');
    state.setThinkingPhase(webSearch ? 'searching' : 'reasoning');

    let prompt = text;
    if (sentAttachments.length > 0) {
      const fileContext = sentAttachments
        .filter(a => !a.type.startsWith('image/'))
        .map(a => `\n[BEGIN FILE: ${a.name}]\n${(a.content || '').slice(0, 30000)}\n[END FILE]`)
        .join('\n\n');
      const imgContext = sentAttachments
        .filter(a => a.type.startsWith('image/'))
        .map(a => `[Image: ${a.name}]`)
        .join('\n');
      prompt = `${fileContext}\n\n${imgContext}\n\nUSER: ${text}`;
    }

    const asstId = genId();
    state.addMessage(sessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId, messageId: asstId });

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    try {
      const currentMsgs = state.getActiveSession()?.messages ?? [];
      let history: { role: "user" | "assistant"; content: string }[] = currentMsgs
        .filter(m => !m.message.thinking && m.message.content)
        .map(m => ({ role: m.message.role as "user" | "assistant", content: m.message.content }));

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

      const handsOffPrefix = handsOff ? `[HANDS-OFF MODE: You have full control. Use built-in tools (web_search, filesystem_read, filesystem_write, terminal_run) freely.
To bundle files, respond with \`[GIA:zip:filename.zip]\` after outputting the file contents in \`[FILE:path] content [FILE]\` format.]\n\n` : '';

      const stateContext = `[SYSTEM: Current Feature State:
- Web Search: ${webSearch ? 'ON' : 'OFF'}
- Extended Thinking: ${extThinking ? 'ON' : 'OFF'}
- Hands-off Mode: ${handsOff ? 'ON' : 'OFF'}
- Local Vision: ${localVision ? 'ON' : 'OFF'}]\n\n`;

      const parserState = createStreamParser();
      let displayAccumulated = '';
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: stateContext + handsOffPrefix + prompt, history,
        images: brainImages,
        localVision,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        temperature: extThinking ? undefined : 0.7,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, parserState);
          if (newDisplay) displayAccumulated += newDisplay;
          state.updateMessage(sessionId, asstId, displayAccumulated, parserState.thoughtsAccumulated || undefined);
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          parserState.thoughtsAccumulated += (parserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: parserState.thoughtsAccumulated }));
          state.updateMessage(sessionId, asstId, displayAccumulated, parserState.thoughtsAccumulated);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
        }
      });

      if (ctrl.signal.aborted) return;

      flushThinkBlock(parserState);

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

      const rawContent = processStreamForDisplay(parserState.accumulated) || displayAccumulated;
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
      setLiveThoughts(prev => { const n = {...prev}; delete n[asstId]; return n; });
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, [loading]);

  const handleContinue = useCallback(async (msgId: string) => {
    const state = useGiaStore.getState();
    const { webSearch } = state;
    if (!state.activeSessionId || loading) return;
    const msgs = state.getActiveSession()?.messages ?? [];
    const msgIndex = msgs.findIndex(m => m.message.id === msgId);
    if (msgIndex < 0) return;
    const lastContent = msgs[msgIndex]?.message.content || '';
    if (!lastContent) return;

    const asstId = genId();
    state.addMessage(state.activeSessionId, {
      id: asstId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true,
    });
    setStreamingMsgId(asstId);
    setLoading(true);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId: state.activeSessionId, messageId: asstId });
    state.setIntentState('thinking');
    state.setThinkingPhase(webSearch ? 'searching' : 'reasoning');

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    try {
      let history: { role: "user" | "assistant"; content: string }[] = msgs.slice(0, msgIndex + 1)
        .filter(m => !m.message.thinking && m.message.content)
        .map(m => ({ role: m.message.role as "user" | "assistant", content: m.message.content }));

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
      let contDisplayAccumulated = '';
      state.setIntentState('responding');
      state.setThinkingPhase('writing');
      const contRes = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: 'Continue from where you left off. Do not repeat what was already said. Just continue naturally.',
        history: [...history, { role: 'assistant', content: lastContent }],
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, contParserState);
          if (newDisplay) contDisplayAccumulated += newDisplay;
          state.updateMessage(state.activeSessionId!, asstId, contDisplayAccumulated, contParserState.thoughtsAccumulated || undefined);
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          contParserState.thoughtsAccumulated += (contParserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: contParserState.thoughtsAccumulated }));
          state.updateMessage(state.activeSessionId!, asstId, contDisplayAccumulated, contParserState.thoughtsAccumulated);
        },
      });
      if (!ctrl.signal.aborted) {
        flushThinkBlock(contParserState);
        state.updateMessage(state.activeSessionId!, asstId, contDisplayAccumulated || processStreamForDisplay(contParserState.accumulated), contParserState.thoughtsAccumulated || undefined);
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
      if (!ctrl.signal.aborted) {
        const msg = err instanceof Error ? err.message : 'Continue failed.';
        state.updateMessage(state.activeSessionId!, asstId, '⚠️ ' + msg);
        useGiaStore.setState({
          sessions: useGiaStore.getState().sessions.map(s =>
            s.id === state.activeSessionId
              ? { ...s, messages: s.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, error: true } } : m) }
              : s
          ),
        });
      }
    } finally {
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, [loading]);

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

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    setLoading(true);
    useGiaStore.getState().setGenerationState({ active: true, module: 'chat', sessionId, messageId: asstId });
    state.setIntentState('responding');

    try {
      const currentMsgs = state.getActiveSession()?.messages ?? [];
      const history: { role: "user" | "assistant"; content: string }[] = currentMsgs
        .filter(m => !m.message.thinking && m.message.content)
        .map(m => ({ role: m.message.role as "user" | "assistant", content: m.message.content }));

      const clarParserState = createStreamParser();
      let clarDisplayAccumulated = '';
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
          state.updateMessage(sessionId, asstId, clarDisplayAccumulated, clarParserState.thoughtsAccumulated || undefined);
          const lastChunk = chunk.replace(/```tool[^]*$/g, '').trim();
          if (lastChunk.length > 1) {
            TTSService.speak(lastChunk, true);
          }
        },
        onThought: (thought) => {
          clarParserState.thoughtsAccumulated += (clarParserState.thoughtsAccumulated ? '\n' : '') + thought;
          setLiveThoughts(prev => ({ ...prev, [asstId]: clarParserState.thoughtsAccumulated }));
          state.updateMessage(sessionId, asstId, clarDisplayAccumulated, clarParserState.thoughtsAccumulated);
          useGiaStore.getState().addConsoleLog({ type: 'thought', content: thought });
          useGiaStore.setState({ showConsole: true });
        }
      });
      if (!ctrl.signal.aborted) {
        flushThinkBlock(clarParserState);
        state.updateMessage(sessionId, asstId, clarDisplayAccumulated || processStreamForDisplay(clarParserState.accumulated), clarParserState.thoughtsAccumulated || undefined);
        notifyIfBackground('chat', sessionId, asstId);
      }
    } catch (err: unknown) {
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
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, []);

  const handleRetry = useCallback(async (id: string) => {
    const state = useGiaStore.getState();
    const { webSearch, extThinking } = state;
    const msgs = state.getActiveSession()?.messages ?? [];
    const msgIndex = msgs.findIndex(m => m.message.id === id);
    if (msgIndex <= 0 || !state.activeSessionId) return;
    const originalPrompt = msgs[msgIndex - 1]?.message.content || '';
    if (!originalPrompt) return;

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

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

    try {
      const history: { role: "user" | "assistant"; content: string }[] = msgs.slice(0, msgIndex - 1)
        .filter(m => !m.message.thinking && m.message.content)
        .map(m => ({ role: m.message.role as "user" | "assistant", content: m.message.content }));

      const retryParserState = createStreamParser();
      let retryDisplayAccumulated = '';
      state.setIntentState('responding');
      const genRes = await GiaBrain.generate({
        signal: ctrl.signal,
        prompt: originalPrompt, history,
        useWebSearch: webSearch,
        useExtendedThinking: extThinking,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          const newDisplay = sharedProcessStreamChunk(chunk, retryParserState);
          if (newDisplay) retryDisplayAccumulated += newDisplay;
          state.updateMessage(state.activeSessionId!, id, retryDisplayAccumulated);
        },
      });
      if (!ctrl.signal.aborted) {
        state.updateMessage(state.activeSessionId!, id, retryDisplayAccumulated || processStreamForDisplay(retryParserState.accumulated));
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
      setLoading(false);
      setStreamingMsgId(null);
      useGiaStore.getState().setGenerationState({ active: false, module: null, sessionId: null, messageId: null });
      useGiaStore.getState().setIntentState('idle');
      useGiaStore.getState().setThinkingPhase('idle');
    }
  }, []);

  return {
    loading, setLoading,
    streamingMsgId, setStreamingMsgId,
    liveThoughts, setLiveThoughts,
    abortRef, abortTimeoutRef,
    responseStartRef, responseTimesRef, lastUserMsgRef,
    handleSend, handleContinue, handleClarificationAnswer,
    handleRetry, handleStop,
  };
}
