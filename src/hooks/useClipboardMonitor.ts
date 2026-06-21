import { useEffect, useRef, useState, useCallback } from 'react';
import { useGiaStore } from '../store/useGiaStore';

export function useClipboardMonitor() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const lastClipboardRef = useRef('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!navigator.clipboard?.readText) return;

    intervalRef.current = setInterval(async () => {
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
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
