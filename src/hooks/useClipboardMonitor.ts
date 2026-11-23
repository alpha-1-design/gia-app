import { useEffect, useRef, useState, useCallback } from 'react';
import { useGiaStore } from '../store/useGiaStore';

/**
 * Clipboard watcher. Battery contract:
 *  - Polls ONLY while the app is visible (hidden polling is pure waste —
 *    Android blocks background clipboard access anyway on 10+).
 *  - 10s cadence instead of 5s: clipboard "paste intent" is not latency
 *    sensitive, and halving the wake rate halves the IPC + permission
 *    checks this loop generates while the app sits open in the foreground.
 */
const POLL_MS = 10000;

export function useClipboardMonitor() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const lastClipboardRef = useRef('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!navigator.clipboard?.readText) return;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const text = await navigator.clipboard.readText();
        if (text && text !== lastClipboardRef.current && text.length > 20 && text.length < 5000) {
          lastClipboardRef.current = text;
          setCopiedText(text);
        }
      } catch {
        // Permission not granted or clipboard empty — silently skip
      } finally {
        fetchingRef.current = false;
      }
    };

    const start = () => {
      if (intervalRef.current === null) {
        intervalRef.current = setInterval(() => void poll(), POLL_MS);
      }
    };
    const stop = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const dismissCopied = useCallback(() => {
    setCopiedText(null);
  }, []);

  const pasteCopied = useCallback(() => {
    if (!copiedText) return;
    useGiaStore.getState().setPendingInput(copiedText);
    useGiaStore.getState().setModule('chat');
    setCopiedText(null);
  }, [copiedText]);

  return { copiedText, dismissCopied, pasteCopied };
}
