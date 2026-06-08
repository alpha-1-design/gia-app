import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger';

const COPY_FEEDBACK_DURATION = 1500;

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }; }, []);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(e => logger.warn('[useCopy] Failed to copy to clipboard:', e));
    setCopied(true);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
  }, []);
  return [copied, copy];
}
