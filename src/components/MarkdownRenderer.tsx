import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import CodeBlock from './CodeBlock';

interface Props { content: string; className?: string }

const InlineCode: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);
  return (
    <code
      onClick={copy}
      title="Click to copy"
      className="cursor-pointer transition-colors"
      style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', padding: '1px 7px', borderRadius: '5px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', border: '1px solid rgba(168,85,247,0.15)' }}
    >
      {copied ? '✓' : code}
    </code>
  );
};

const inlineRender = (text: string, footnotes: Map<string, string>): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~|\$\$[^$]+\$\$|\$[^$\s][^$]*?\$|!\[[^\]]*\]\([^)]+\)|\[\^[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4)
      return <del key={i} style={{ color: 'var(--gia-muted)' }}>{part.slice(2, -2)}</del>;
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 3)
      return <InlineCode key={i} code={part.slice(1, -1)} />;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return <a key={i} href={link[2]} style={{ color: '#a855f7', textDecoration: 'underline', textUnderlineOffset: '2px' }} target="_blank" rel="noopener noreferrer">{link[1]}</a>;

    const img = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img)
      return <img key={i} src={img[2]} alt={img[1]} loading="lazy" className="my-2 rounded-xl max-w-full" style={{ maxHeight: '400px', border: '1px solid var(--gia-border)' }} />;

    if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4)
      return <MathBlock key={i} formula={part.slice(2, -2)} inline={false} />;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2)
      return <MathBlock key={i} formula={part.slice(1, -1)} inline={true} />;

    const fnRef = part.match(/^\[\^([^\]]+)\]$/);
    if (fnRef && footnotes.has(fnRef[1]))
      return <sup key={i}><a href={`#fn-${fnRef[1]}`} id={`fnref-${fnRef[1]}`} style={{ color: '#a855f7', fontSize: '10px', cursor: 'pointer', textDecoration: 'none' }}>{fnRef[1]}</a></sup>;

    return part;
  });
};

const MATH_CACHE = new Map<string, string>();

const MathBlock: React.FC<{ formula: string; inline: boolean }> = ({ formula, inline }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(typeof (window as any).katex !== 'undefined');

  useEffect(() => {
    if (typeof (window as any).katex !== 'undefined') { setLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    s.onload = () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      document.head.appendChild(link);
      setLoaded(true);
    };
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    const cached = MATH_CACHE.get(formula);
    if (cached) { ref.current.innerHTML = cached; return; }
    try {
      const html = (window as any).katex.renderToString(formula, { displayMode: !inline, throwOnError: false });
      MATH_CACHE.set(formula, html);
      ref.current.innerHTML = html;
    } catch { ref.current.textContent = formula; }
  }, [formula, inline, loaded]);

  return React.createElement(inline ? 'span' : 'div', {
    ref,
    style: inline ? { display: 'inline' } : { margin: '10px 0', overflowX: 'auto', padding: '8px 0', textAlign: 'center' },
    className: inline ? '' : 'katex-block',
  });
};

const MermaidDiagram: React.FC<{ definition: string }> = ({ definition }) => {
  const ref = useRef<HTMLPreElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof (window as any).mermaid !== 'undefined') { setLoaded(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    s.onload = () => { (window as any).mermaid?.initialize({ startOnLoad: false, theme: 'dark' }); setLoaded(true); };
    s.onerror = () => setError('Could not load Mermaid renderer');
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    (window as any).mermaid.run({ nodes: [ref.current] }).catch((e: any) => setError(e.message));
  }, [loaded, definition]);

  if (error) return <div className="text-[11px] p-2 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>{error}</div>;
  return <pre className="mermaid" ref={ref} style={{ margin: '12px 0', background: 'transparent' }}>{definition}</pre>;
};

const InlineSvg: React.FC<{ svg: string }> = ({ svg }) => (
  <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)', background: 'white' }} dangerouslySetInnerHTML={{ __html: svg }} />
);

const RichTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => {
  const [copied, setCopied] = useState(false);
  const copyTable = useCallback(() => {
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(csv).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [headers, rows]);

  return (
    <div style={{ position: 'relative', margin: '12px 0' }}>
      <button onClick={copyTable} className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-opacity hover:opacity-100 opacity-60" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}>
        {copied ? <Check size={9} /> : <Copy size={9} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>{headers.map((h, hi) =>
              <th key={hi} style={{ background: 'var(--gia-surface-3)', padding: '7px 10px', textAlign: 'left', fontWeight: 600, border: '1px solid var(--gia-border)', color: 'var(--gia-muted)', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>{rows.map((row, ri) =>
            <tr key={ri} className="hover-row" style={{ background: ri % 2 === 1 ? 'var(--gia-surface-2)' : 'transparent', transition: 'background 0.15s' }}>
              {row.map((cell, ci) =>
                <td key={ci} style={{ padding: '5px 10px', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>{cell}</td>
              )}
            </tr>
          )}</tbody>
        </table>
      </div>
      <style>{`.hover-row:hover { background: rgba(168,85,247,0.08) !important; }`}</style>
    </div>
  );
};

const parseTaskList = (line: string): React.ReactNode => {
  const m = line.match(/^(\s*[-*+])\s*\[([ xX])\]\s*(.+)/);
  if (!m) return null;
  const checked = m[2] !== ' ';
  return (
    <label className="flex items-start gap-2 py-0.5 cursor-pointer select-none" style={{ margin: '0' }}>
      <input type="checkbox" defaultChecked={checked} readOnly onClick={e => e.preventDefault()} className="mt-0.5 shrink-0 accent-violet-500" style={{ width: '13px', height: '13px' }} />
      <span style={{ color: 'var(--gia-text)', textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.5 : 1 }}>
        {inlineRender(m[3], new Map())}
      </span>
    </label>
  );
};

const MarkdownRenderer: React.FC<Props> = ({ content, className = '' }) => {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  const footnotes = new Map<string, string>();
  let i = 0;

  // First pass: collect footnote definitions
  for (const line of lines) {
    const fnDef = line.match(/^\[\^([^\]]+)\]:\s*(.+)/);
    if (fnDef) footnotes.set(fnDef[1], fnDef[2]);
  }

  while (i < lines.length) {
    const line = lines[i];

    // Collapsible <details>
    if (line.trim().toLowerCase() === '<details>') {
      i++;
      let summary = '';
      const bodyLines: string[] = [];
      if (lines[i]?.trim().toLowerCase().startsWith('<summary>')) {
        summary = lines[i].trim().replace(/<\/summary>/i, '').replace(/<summary>/i, '').trim();
        i++;
      }
      while (i < lines.length && lines[i].trim().toLowerCase() !== '</details>') {
        bodyLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <details key={`d-${i}`} className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)' }}>
          <summary className="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:opacity-80 transition-opacity" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}>{summary || 'Expand'}</summary>
          <div className="p-3" style={{ background: 'var(--gia-surface)' }}><MarkdownRenderer content={bodyLines.join('\n')} /></div>
        </details>
      );
      continue;
    }

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (lang === 'mermaid') {
        nodes.push(<MermaidDiagram key={`mm-${i}`} definition={codeLines.join('\n')} />);
      } else if (lang === 'svg' || lang === 'svg+xml') {
        nodes.push(<InlineSvg key={`svg-${i}`} svg={codeLines.join('\n')} />);
      } else {
        nodes.push(<CodeBlock key={`cb-${i}`} lang={lang} code={codeLines.join('\n')} showRun={true} />);
      }
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.match(/^\s*\|?\s*:?-+:?\s*\|/)) {
      const headers = line.split('|').map(c => c.trim());
      if (headers.length >= 2 && headers[0] === '' && headers[headers.length - 1] === '') {
        headers.shift(); headers.pop();
      }
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i].split('|').map(c => c.trim());
        if (cells.length >= 2 && cells[0] === '' && cells[cells.length - 1] === '') {
          cells.shift(); cells.pop();
        }
        rows.push(cells);
        i++;
      }
      nodes.push(<RichTable key={`t-${i}`} headers={headers} rows={rows} />);
      continue;
    }

    // Definition list
    if (i + 1 < lines.length && lines[i + 1].startsWith(': ')) {
      const terms: { term: string; def: string }[] = [];
      while (i < lines.length && i + 1 < lines.length && lines[i + 1].startsWith(': ')) {
        const term = lines[i].trim();
        i++;
        const defs: string[] = [];
        while (i < lines.length && lines[i].startsWith(': ')) {
          defs.push(lines[i].slice(2).trim());
          i++;
        }
        terms.push({ term, def: defs.join(' ') });
      }
      nodes.push(
        <dl key={`dl-${i}`} style={{ margin: '10px 0' }}>
          {terms.map((t, ti) => (
            <React.Fragment key={ti}>
              <dt style={{ fontWeight: 600, color: 'var(--gia-text)', marginTop: '6px', fontSize: '13px' }}>{t.term}</dt>
              <dd style={{ margin: '2px 0 6px 16px', color: 'var(--gia-muted)', fontSize: '12px', lineHeight: '1.5' }}>{t.def}</dd>
            </React.Fragment>
          ))}
        </dl>
      );
      continue;
    }

    // Block math
    const blockMath = line.match(/^\$\$([^$]+)\$\$$/);
    if (blockMath) {
      nodes.push(<MathBlock key={`bm-${i}`} formula={blockMath[1]} inline={false} />);
      i++; continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { nodes.push(<h1 key={`h1-${i}`} style={{ fontSize: '20px', fontWeight: 700, margin: '16px 0 8px', color: 'white' }}>{inlineRender(h1[1], footnotes)}</h1>); i++; continue; }
    if (h2) { nodes.push(<h2 key={`h2-${i}`} style={{ fontSize: '16px', fontWeight: 600, margin: '14px 0 6px', color: 'white' }}>{inlineRender(h2[1], footnotes)}</h2>); i++; continue; }
    if (h3) { nodes.push(<h3 key={`h3-${i}`} style={{ fontSize: '14px', fontWeight: 600, margin: '12px 0 4px', color: 'white' }}>{inlineRender(h3[1], footnotes)}</h3>); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={`bq-${i}`} style={{ borderLeft: '3px solid #a855f7', paddingLeft: '12px', margin: '10px 0', color: 'var(--gia-muted)', fontStyle: 'italic' }}>
          {inlineRender(line.slice(2), footnotes)}
        </blockquote>
      );
      i++; continue;
    }

    // HR
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      nodes.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--gia-border)', margin: '16px 0' }} />);
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[\-\*\+] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*\+] /)) {
        const taskItem = parseTaskList(lines[i]);
        items.push(
          <li key={i} style={{ margin: '1px 0', listStyle: taskItem ? 'none' : 'disc' }}>
            {taskItem || inlineRender(lines[i].slice(2), footnotes)}
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} style={{ margin: '8px 0', paddingLeft: '20px' }}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} style={{ margin: '2px 0' }}>{inlineRender(lines[i].replace(/^\d+\. /, ''), footnotes)}</li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} style={{ margin: '8px 0', paddingLeft: '20px' }}>{items}</ol>);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={`sp-${i}`} style={{ height: '6px' }} />);
      i++; continue;
    }

    // Footnote definition (skip — already collected)
    if (line.match(/^\[\^[^\]]+\]:\s*.+/)) {
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={`p-${i}`} style={{ margin: '4px 0', lineHeight: '1.65', color: 'var(--gia-text)' }}>
        {inlineRender(line, footnotes)}
      </p>
    );
    i++;
  }

  // Render footnotes section
  if (footnotes.size > 0) {
    const fnNodes: React.ReactNode[] = [];
    let fnIdx = 0;
    for (const [label, text] of footnotes) {
      fnNodes.push(
        <div key={label} id={`fn-${label}`} className="flex items-start gap-2 py-1 text-[11px]" style={{ color: 'var(--gia-muted)' }}>
          <sup className="shrink-0" style={{ color: '#a855f7' }}>{label}</sup>
          <span>{text}</span>
          <a href={`#fnref-${label}`} style={{ color: 'var(--gia-muted-2)', textDecoration: 'none', marginLeft: '4px', fontSize: '10px' }}>↩</a>
        </div>
      );
      fnIdx++;
    }
    nodes.push(
      <div key="footnotes" className="mt-6 pt-3" style={{ borderTop: '1px solid var(--gia-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--gia-muted-2)' }}>Footnotes</p>
        {fnNodes}
      </div>
    );
  }

  return (
    <div className={`gia-markdown ${className}`} style={{ fontSize: '14px' }}>
      {nodes}
    </div>
  );
};

export default React.memo(MarkdownRenderer);
