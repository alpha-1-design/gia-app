import React, { useEffect, useRef, useState } from 'react';

interface MermaidAPI {
  initialize(config: Record<string, unknown>): void;
  run(options: Record<string, unknown>): Promise<unknown>;
}

interface Props {
  definition: string;
}

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

const MermaidRenderer: React.FC<Props> = ({ definition }) => {
  const ref = useRef<HTMLPreElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if ('mermaid' in window) { setLoaded(true); return; }
    const existing = document.querySelector('script[src*="mermaid.min.js"]');
    if (existing) {
      // The script may still be loading — piggyback on its onload instead of
      // assuming it finished (the previous early-return showed a blank box
      // when a sibling had just inserted the tag).
      existing.addEventListener('load', () => {
        (window as unknown as { mermaid: MermaidAPI }).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        setLoaded(true);
      }, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = MERMAID_CDN;
    s.onload = () => {
      (window as unknown as { mermaid: MermaidAPI }).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      setLoaded(true);
    };
    s.onerror = () => setError('Could not load Mermaid renderer');
    document.head.appendChild(s);
    // No cleanup: the script tag is shared by every MermaidRenderer on the
    // page and window.mermaid stays useful after this instance unmounts.
    // Removing it here aborted in-flight loads for sibling renderers.
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    // A diagram streams in token by token: intermediate states legitimately
    // fail to parse. Reset the error on every new definition and only mark
    // the error if the FINAL version also fails.
    setError('');
    (window as unknown as { mermaid: MermaidAPI }).mermaid
      .run({ nodes: [ref.current] })
      .then(() => setError(''))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [loaded, definition]);

  if (error) {
    return (
      <div
        className="text-[11px] p-2 rounded"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
      >
        {error}
      </div>
    );
  }

  return (
    <pre
      className="mermaid"
      ref={ref}
      style={{ margin: '12px 0', background: 'transparent' }}
    >
      {definition}
    </pre>
  );
};

export default React.memo(MermaidRenderer);
