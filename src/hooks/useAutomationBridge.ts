import { useEffect } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { useAutonomyStore } from '../store/useAutonomyStore';
import { useProviderStore } from '../store/useProviderStore';
import GiaBrain from '../services/GiaBrain';
import { genId } from '../utils/id';

// Bridges AutomationEngine's window CustomEvents to real store actions.
// AutomationEngine fires these (gia:toggle-feature / gia:send-message /
// gia:create-goal) but nothing was listening, so rule actions were no-ops.
export function useAutomationBridge(): void {
  useEffect(() => {
    const onToggleFeature = (e: Event) => {
      const feature = (e as CustomEvent<string>).detail;
      const s = useGiaStore.getState();
      if (feature === 'web_search') s.setWebSearch(!s.webSearch);
      else if (feature === 'thinking') s.setExtThinking(!s.extThinking);
      else if (feature === 'hands_off') s.setHandsOff(!s.handsOff);
    };

    const onSendMessage = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (!text) return;
      useGiaStore.getState().setPendingAction({ type: 'send-message', data: { text } });
    };

    const onCreateGoal = (e: Event) => {
      const d = (e as CustomEvent<{ title: string; description?: string }>).detail;
      if (!d?.title) return;
      useAutonomyStore.getState().addGoal(d.title, d.description || '', 'medium', 'autonomous');
      useGiaStore.getState().addNotification(`Goal created: ${d.title}`);
    };

    const onPendingTaskReady = async (e: Event) => {
      const task = (e as CustomEvent).detail;
      if (!task?.prompt) return;
      const store = useGiaStore.getState();
      const providerStore = useProviderStore.getState();
      const sessionId = task.sessionId || store.activeSessionId;
      if (!sessionId) return;

      const userMsgId = genId();
      const asstMsgId = genId();
      store.addMessage(sessionId, { id: userMsgId, role: 'user', content: task.prompt, timestamp: Date.now() });
      store.addMessage(sessionId, { id: asstMsgId, role: 'assistant', content: '', timestamp: Date.now(), thinking: true });

      try {
        const systemPrompt = task.agentId
          ? `You are "${task.agentName || 'Agent'}". Complete the following task as that persona.\nTask: ${task.prompt}`
          : undefined;
        const result = await GiaBrain.generate({
          prompt: task.prompt,
          systemPrompt,
          signal: new AbortController().signal,
        });
        store.updateMessage(sessionId, asstMsgId, result.text);
        store.addNotification(`✅ Task completed${task.agentName ? ` (${task.agentName})` : ''}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Task failed';
        store.updateMessage(sessionId, asstMsgId, msg);
        store.addNotification(`❌ Task failed: ${msg}`);
      }
      providerStore.removePendingTask(task.id);
    };

    window.addEventListener('gia:toggle-feature', onToggleFeature as EventListener);
    window.addEventListener('gia:send-message', onSendMessage as EventListener);
    window.addEventListener('gia:create-goal', onCreateGoal as EventListener);
    window.addEventListener('gia:pending-task-ready', onPendingTaskReady as EventListener);

    return () => {
      window.removeEventListener('gia:toggle-feature', onToggleFeature as EventListener);
      window.removeEventListener('gia:send-message', onSendMessage as EventListener);
      window.removeEventListener('gia:create-goal', onCreateGoal as EventListener);
      window.removeEventListener('gia:pending-task-ready', onPendingTaskReady as EventListener);
    };
  }, []);
}
