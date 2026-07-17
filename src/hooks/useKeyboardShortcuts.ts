import { useEffect, useRef } from 'react';

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      for (const s of shortcutsRef.current) {
        const wantsMeta = s.meta || s.ctrl;
        const hasMeta = s.meta ? (e.metaKey || e.ctrlKey) : s.ctrl ? e.ctrlKey : true;
        const needsNoMeta = !wantsMeta && (e.metaKey || e.ctrlKey);

        if (needsNoMeta) continue;

        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase() ||
                         e.code.toLowerCase() === s.key.toLowerCase();

        if (hasMeta && shiftMatch && keyMatch) {
          if (s.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          s.handler();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
}
