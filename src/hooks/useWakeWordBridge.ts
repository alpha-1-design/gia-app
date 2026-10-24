import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { GIAWakeWord } from '../services/GIAWakeWord';
import { useGiaStore } from '../store/useGiaStore';

/**
 * The wake-word service is a real foreground service with bundled openWakeWord
 * models. This hook connects it to the app shell:
 *
 * - a detection (foreground, background relaunch, or cold start) opens Chat
 *   and arms the existing voice-start path;
 * - if the user left Background Wake Word on, the service is restarted on
 *   launch when Android has killed it.
 *
 * It deliberately does not fake or simulate anything: if the native service is
 * missing, nothing happens.
 */
export function useWakeWordBridge(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('GIAWakeWord')) return;

    let disposed = false;
    let handle: { remove: () => Promise<void> } | undefined;

    const wake = (keyword: string) => {
      if (disposed) return;
      const st = useGiaStore.getState();
      st.setModule('chat');
      st.setPendingAction({ type: 'voice-start', data: { keyword } });
      st.addNotification(`Heard “${keyword}” — listening`);
    };

    void GIAWakeWord.addListener('wakeWordDetected', ({ keyword }) => {
      wake(keyword || 'wake word');
    }).then(h => {
      if (disposed) void h.remove();
      else handle = h;
    });

    // A detection that woke the app before the JS bridge was attached.
    void GIAWakeWord.getPendingWakeWord()
      .then(p => { if (p.detected) wake(p.keyword || 'wake word'); })
      .catch(() => undefined);

    // Re-arm a service Android killed while the app was closed.
    const st = useGiaStore.getState();
    if (st.nativeWakeWord || st.autoStartWakeWord) {
      const sensitivity = Number(localStorage.getItem('gia-native-sensitivity') ?? '0.7');
      void GIAWakeWord.getStatus().then(status => {
        if (disposed || status.running) return;
        return GIAWakeWord.startListening({
          keyword: st.nativeWakeKeyword || 'hey_jarvis',
          sensitivity: Number.isFinite(sensitivity) ? sensitivity : 0.7,
          emitScores: false,
        });
      }).catch(() => undefined);
    }

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, []);
}
