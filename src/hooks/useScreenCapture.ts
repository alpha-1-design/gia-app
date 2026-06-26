import { useCallback, useState } from 'react';
import { useGiaStore } from '../store/useGiaStore';
import { genId } from '../utils/id';
import { screenAgent } from '../services/ScreenAgent';

export function useScreenCapture() {
  const [capturing, setCapturing] = useState(false);

  const captureScreen = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);

    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Native Android — use the accessibility service plugin
        const { GIAScreenAgent } = await import('../services/GIAScreenAgent');
        const result = await GIAScreenAgent.capture();

        const state = useGiaStore.getState();
        const sessionId = state.activeSessionId || state.createSession();

        const screenText = result.text?.slice(0, 3000) || '';
        const elementSummary = result.elements
          .filter(e => e.clickable || e.editable)
          .slice(0, 20)
          .map(e => `  [${e.type}] "${e.text}" at (${e.bounds.centerX}, ${e.bounds.centerY})`)
          .join('\n');

        const content = [
          `📱 Screen captured from ${result.elements?.[0]?.className || 'current app'}`,
          '',
          screenText ? `**Visible text:**\n${screenText}` : '',
          elementSummary ? `\n**Interactive elements:**\n${elementSummary}` : '',
        ].filter(Boolean).join('\n');

        state.addMessage(sessionId, {
          id: genId(),
          role: 'user',
          content,
          timestamp: Date.now(),
        });
      } else {
        // Web — use getDisplayMedia + OCR
        await screenAgent.activate();
        const content = await screenAgent.captureAndAnalyze();
        if (!content) {
          useGiaStore.getState().addNotification('Screen capture cancelled or failed');
          return;
        }

        const state = useGiaStore.getState();
        const sessionId = state.activeSessionId || state.createSession();

        state.addMessage(sessionId, {
          id: genId(),
          role: 'user',
          content: [
            `📱 Screen captured`,
            '',
            content.text ? `**Visible text:**\n${content.text.slice(0, 3000)}` : '',
            content.elements.length > 0 ? `\n**Found ${content.elements.length} interactive elements**` : '',
          ].filter(Boolean).join('\n'),
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Screen capture failed';
      useGiaStore.getState().addNotification(msg);
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  return { captureScreen, capturing };
}
