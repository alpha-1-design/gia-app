import React from 'react';
import CodeBlock from './CodeBlock';

interface Props { content: string; className?: string }

const inlineRender = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4)
      return <del key={i} style={{ color: 'var(--gia-muted)' }}>{part.slice(2, -2)}</del>;
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3)
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 3)
      return <code key={i} style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', padding: '1px 6px', borderRadius: '5px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{part.slice(1, -1)}</code>;
    const link = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (link)
      return <a key={i} href={link[2]} style={{ color: '#a855f7', textDecoration: 'underline', textUnderlineOffset: '2px' }} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return part;
  });
};

const MarkdownRenderer: React.FC<Props> = ({ content, className = '' }) => {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(<CodeBlock key={i} lang={lang} code={codeLines.join('\n')} showRun={true} />);
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
      nodes.push(
        <div key={i} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{headers.map((h, hi) =>
                <th key={hi} style={{ background: 'var(--gia-surface-3)', padding: '6px 10px', textAlign: 'left', fontWeight: 600, border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>{rows.map((row, ri) =>
              <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--gia-surface-2)' : 'transparent' }}>
                {row.map((cell, ci) =>
                  <td key={ci} style={{ padding: '5px 10px', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>{cell}</td>
                )}
              </tr>
            )}</tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { nodes.push(<h1 key={i} style={{ fontSize: '20px', fontWeight: 700, margin: '16px 0 8px', color: 'white' }}>{inlineRender(h1[1])}</h1>); i++; continue; }
    if (h2) { nodes.push(<h2 key={i} style={{ fontSize: '16px', fontWeight: 600, margin: '14px 0 6px', color: 'white' }}>{inlineRender(h2[1])}</h2>); i++; continue; }
    if (h3) { nodes.push(<h3 key={i} style={{ fontSize: '14px', fontWeight: 600, margin: '12px 0 4px', color: 'white' }}>{inlineRender(h3[1])}</h3>); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} style={{ borderLeft: '3px solid #a855f7', paddingLeft: '12px', margin: '10px 0', color: 'var(--gia-muted)', fontStyle: 'italic' }}>
          {inlineRender(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // HR
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--gia-border)', margin: '16px 0' }} />);
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[\-\*\+] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*\+] /)) {
        items.push(<li key={i} style={{ margin: '2px 0', color: 'var(--gia-text)' }}>{inlineRender(lines[i].slice(2))}</li>);
        i++;
      }
      nodes.push(<ul key={i} style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'disc' }}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const text = lines[i].replace(/^\d+\. /, '');
        items.push(<li key={i} style={{ margin: '2px 0', color: 'var(--gia-text)' }}>{inlineRender(text)}</li>);
        i++;
      }
      nodes.push(<ol key={i} style={{ margin: '8px 0', paddingLeft: '20px' }}>{items}</ol>);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: '6px' }} />);
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} style={{ margin: '4px 0', lineHeight: '1.65', color: 'var(--gia-text)' }}>
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return (
    <div className={`gia-markdown ${className}`} style={{ fontSize: '14px' }}>
      {nodes}
    </div>
  );
};

export default React.memo(MarkdownRenderer);
