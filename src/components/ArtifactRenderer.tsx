import React, { useMemo } from 'react';
import MermaidRenderer from './MermaidRenderer';

interface Props {
  type: string;
  content: string;
  title: string;
}

const stripScripts = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');

const InlineSvg: React.FC<{ svg: string }> = ({ svg }) => (
  <div className="rounded-lg overflow-hidden" style={{ background: 'var(--gia-surface)' }} dangerouslySetInnerHTML={{ __html: stripScripts(svg) }} />
);

const HtmlPreview: React.FC<{ html: string; title: string }> = ({ html, title }) => {
  const sanitized = useMemo(() => stripScripts(html), [html]);
  return (
    <iframe
      title={title}
      srcDoc={sanitized}
      sandbox="allow-scripts"
      className="w-full rounded-lg"
      style={{ border: '1px solid var(--gia-border)', background: 'var(--gia-surface)', minHeight: '300px', height: '400px' }}
    />
  );
};

const ArtifactRenderer: React.FC<Props> = ({ type, content, title }) => {
  if (type === 'text/html' || type === 'html') {
    return <HtmlPreview html={content} title={title} />;
  }
  if (type === 'image/svg+xml' || type === 'svg') {
    return <InlineSvg svg={content} />;
  }
  if (type === 'application/vnd.mermaid' || type === 'mermaid') {
    return <MermaidRenderer definition={content} />;
  }
  return (
    <pre className="text-xs p-3 rounded-lg" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)', overflow: 'auto', maxHeight: '400px', whiteSpace: 'pre-wrap' }}>
      {content}
    </pre>
  );
};

export default React.memo(ArtifactRenderer);
