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
    if (document.querySelector('script[src*="mermaid.min.js"]')) { setLoaded(true); return; }
    const s = document.createElement('script');
    s.src = MERMAID_CDN;
    s.onload = () => {
      (window as unknown as { mermaid: MermaidAPI }).mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      setLoaded(true);
    };
    s.onerror = () => setError('Could not load Mermaid renderer');
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    (window as unknown as { mermaid: MermaidAPI }).mermaid
      .run({ nodes: [ref.current] })
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
