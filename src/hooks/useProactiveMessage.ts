import { useState, useEffect } from 'react';
import ProactiveEngine, { type ProactiveMessage } from '../services/ProactiveEngine';

/**
 * Hook that provides time-aware proactive messages for the empty chat state.
 * Rotates through tips periodically when idle.
 */
export function useProactiveMessage() {
  const [greeting] = useState<ProactiveMessage>(() => ProactiveEngine.getGreeting());
  const [tip, setTip] = useState<ProactiveMessage>(() => ProactiveEngine.getTip());

  // Rotate tips every 60 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setTip(ProactiveEngine.getTip());
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Refresh greeting when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        // don't replace greeting on visibility, keep the session greeting
        setTip(ProactiveEngine.getTip());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return { greeting, tip };
}
