import { useEffect, useState } from 'react';

let highlightModPromise: Promise<typeof import('../utils/shikiHighlighter')> | null = null;

function getHighlightMod(): Promise<typeof import('../utils/shikiHighlighter')> {
  if (!highlightModPromise) {
    highlightModPromise = import('../utils/shikiHighlighter');
  }
  return highlightModPromise;
}

function initialShikiTheme(): 'github-dark' | 'github-light' {
  if (typeof document === 'undefined') return 'github-dark';
  return document.documentElement.dataset.theme === 'light' ? 'github-light' : 'github-dark';
}

export function useShikiHighlight(code: string, lang?: string, delayMs = 120): string | null {
  const [theme, setTheme] = useState<'github-dark' | 'github-light'>(initialShikiTheme);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(current => {
        const next = initialShikiTheme();
        return current === next ? current : next;
      });
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const mod = await getHighlightMod();
      if (cancelled) return;
      const resolvedTheme = theme;
      const cached = mod.cachedShikiHtml(code, lang, resolvedTheme);
      if (cached) {
        setHtml(cached);
        return;
      }
      const next = await mod.shikiHighlightToHtml(code, lang, resolvedTheme);
      if (cancelled || !next) return;
      mod.storeShikiHtml(code, lang, resolvedTheme, next);
      setHtml(next);
    };

    timer = setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, lang, theme, delayMs]);

  return html;
}