import { useCallback, useRef, useEffect } from 'react';
import { autoMemory } from '../services/AutoMemory';

export function useAutoMemory() {
  const processedRef = useRef<Set<string>>(new Set());

  const processMessage = useCallback(async (text: string, messageId: string, role: 'user' | 'assistant') => {
    if (!text || text.length < 5) return;
    if (processedRef.current.has(messageId)) return;

    processedRef.current.add(messageId);
    if (processedRef.current.size > 500) {
      const first = processedRef.current.values().next().value;
      if (first) processedRef.current.delete(first);
    }

    await autoMemory.processMessage(text, messageId, role);
  }, []);

  const getStats = useCallback(() => {
    return autoMemory.getProcessingStats();
  }, []);

  return { processMessage, getStats };
}

export function useAutoMemoryIntegration() {
  const { processMessage } = useAutoMemory();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const { text, messageId, role } = event.detail;
      if (text && messageId && role) {
        processMessage(text, messageId, role);
      }
    };

    window.addEventListener('gia:new-message' as string, handleNewMessage as EventListener);

    return () => {
      window.removeEventListener('gia:new-message' as string, handleNewMessage as EventListener);
    };
  }, [processMessage]);

  return { textareaRef };
}
