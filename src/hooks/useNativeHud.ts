import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGiaStore } from '../store/useGiaStore';
import GiaBrain from '../services/GiaBrain';
import { GIAHud } from '../services/GIAHud';
import GIAForegroundService from '../services/GIAForegroundService';
import { genId } from '../utils/id';
import { extractSuggestions } from '../utils/suggestions';
import { logger } from '../utils/logger';

/**
 * Bridges the native Android HUD overlay to the same brain/session as the
 * in-app chat.
 *
 * The overlay is a foreground service, so it survives leaving GIA and opening
 * another app. The WebView is kept alive while the HUD is enabled, and native
 * input is forwarded here as `hudMessage` events. Responses stream back into
 * the overlay with `streamDelta`.
 *
 * While GIA is in the foreground the in-app FloatingHud is shown instead, so
 * the user never sees two chat windows at once.
 */
export function useNativeHud(): void {
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const appActiveRef = useRef(true);
  const showHudRef = useRef(false);
  const startedCoreRef = useRef(false);

  async function handleHudMessage(raw: string) {
    const text = raw.trim();
    if (!text || busyRef.current) return;

    const state = useGiaStore.getState();
    if (state.generationState.active) {
      await GIAHud.appendMessage({ role: 'assistant', text: 'GIA is busy in chat. Wait for that answer to finish.' });
      await GIAHud.setBusy({ busy: false });
      return;
    }

    busyRef.current = true;
    await GIAHud.setBusy({ busy: true });

    const sessionId = state.activeSessionId ?? state.createSession();
    const now = Date.now();
    const userMsg = { id: genId(), role: 'user' as const, content: text, timestamp: now };
    const asstId = genId();
    state.addMessage(sessionId, userMsg);
    state.addMessage(sessionId, { id: asstId, role: 'assistant', content: '', timestamp: now + 1, thinking: true });

    const history = useGiaStore.getState().sessions
      .find(s => s.id === sessionId)?.messages
      .map(m => m.message)
      .filter(m => m.id !== asstId && !m.thinking && m.content)
      .slice(-12)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) ?? [];

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let accumulated = '';

    try {
      const res = await GiaBrain.generate({
        signal: ctrl.signal,
        checkpointKey: `hud:${sessionId}:${asstId}`,
        messageId: asstId,
        prompt: text,
        history,
        onStream: (chunk) => {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          if (accumulated.includes('```tool')) return;
          void GIAHud.streamDelta({ delta: chunk, done: false });
        },
      });
      if (ctrl.signal.aborted) return;
      const final = extractSuggestions(res.text || accumulated).content;
      useGiaStore.getState().updateMessage(sessionId, asstId, final);
      await GIAHud.streamDelta({ delta: '', done: true, finalText: final });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      useGiaStore.getState().updateMessage(sessionId, asstId, message);
      await GIAHud.streamDelta({ delta: '', done: true, finalText: message });
    } finally {
      busyRef.current = false;
      abortRef.current = null;
      useGiaStore.setState(s => ({
        sessions: s.sessions.map(sess => sess.id === sessionId
          ? { ...sess, messages: sess.messages.map(m => m.message.id === asstId ? { ...m, message: { ...m.message, thinking: false } } : m) }
          : sess),
      }));
      await GIAHud.setBusy({ busy: false });
    }
  }

  const syncHistory = async () => {
    if (!Capacitor.isNativePlatform()) return;
    const state = useGiaStore.getState();
    const session = state.sessions.find(s => s.id === state.activeSessionId);
    const messages = (session?.messages ?? [])
      .map(m => m.message)
      .filter(m => !m.thinking && m.content && !m.error)
      .slice(-8);
    await GIAHud.clearMessages();
    if (messages.length === 0) {
      await GIAHud.appendMessage({ role: 'assistant', text: 'Ask GIA anything.' });
    } else {
      for (const message of messages) {
        await GIAHud.appendMessage({
          role: message.role === 'user' ? 'user' : 'assistant',
          text: message.content,
        });
      }
    }
  };

  const startNativeHud = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // Start the foreground service while GIA is still foreground. Starting
      // it later, from the background, is restricted on Android 12+.
      await GIAHud.start();
      if (!startedCoreRef.current) {
        await GIAForegroundService.start(false);
        startedCoreRef.current = true;
      }
      await GIAForegroundService.enableKeepAlive();
    } catch (e) {
      logger.warn('[NativeHud] Could not start the HUD service:', e);
      useGiaStore.getState().setShowHud(false);
      useGiaStore.getState().addNotification(
        e instanceof Error && /permission/i.test(e.message)
          ? 'Allow “Display over other apps” to keep the floating HUD on screen.'
          : 'Could not start the floating HUD.',
      );
      return;
    }

    if (appActiveRef.current) {
      // The in-app FloatingHud is visible while GIA is foreground.
      await GIAHud.hide();
      return;
    }

    try {
      await GIAHud.show();
      await syncHistory();
    } catch (e) {
      logger.warn('[NativeHud] Could not show overlay:', e);
      useGiaStore.getState().setShowHud(false);
      useGiaStore.getState().addNotification(
        e instanceof Error && /permission/i.test(e.message)
          ? 'Allow “Display over other apps” to keep the floating HUD on screen.'
          : 'Could not start the floating HUD.',
      );
    }
  };

  // Persisted opt-in -> native service lifecycle.
  useEffect(() => {
    const show = useGiaStore.getState().showHud;
    showHudRef.current = show;
    if (!Capacitor.isNativePlatform()) return;
    if (show) {
      void startNativeHud();
    } else {
      void GIAHud.stop();
      if (startedCoreRef.current) {
        void GIAForegroundService.disableKeepAlive();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the native overlay and the in-app HUD mutually exclusive.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appActiveRef.current = isActive;
      if (!showHudRef.current) return;
      if (isActive) {
        void GIAHud.hide();
      } else {
        void startNativeHud();
      }
    }).then(h => { handle = h; });
    return () => { void handle?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to the header toggle after mount.
  useEffect(() => {
    const unsubscribe = useGiaStore.subscribe((state, prev) => {
      if (state.showHud === prev.showHud) return;
      showHudRef.current = state.showHud;
      if (!Capacitor.isNativePlatform()) return;
      if (state.showHud) {
        void startNativeHud();
      } else {
        void GIAHud.stop();
        if (startedCoreRef.current) {
          void GIAForegroundService.disableKeepAlive();
        }
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the overlay in step when an in-app generation finishes in the
  // background, or the user switches sessions from the app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const unsubscribe = useGiaStore.subscribe((state, prev) => {
      if (appActiveRef.current || !showHudRef.current) return;
      const finished = prev.generationState.active && !state.generationState.active;
      const switched = state.activeSessionId !== prev.activeSessionId;
      if (finished || switched) void syncHistory();
    });
    return unsubscribe;
  }, []);

  // Native overlay input -> the same brain/session as Chat.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let messageHandle: { remove: () => Promise<void> } | null = null;
    let closedHandle: { remove: () => Promise<void> } | null = null;
    void GIAHud.addListener('hudMessage', ({ text }) => {
      void handleHudMessage(text);
    }).then(h => { messageHandle = h; });
    void GIAHud.addListener('hudClosed', () => {
      useGiaStore.getState().setShowHud(false);
    }).then(h => { closedHandle = h; });
    return () => {
      void messageHandle?.remove();
      void closedHandle?.remove();
      abortRef.current?.abort();
    };
  }, []);

}
