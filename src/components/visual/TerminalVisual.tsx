import React, { useState, useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface TerminalData {
  output?: string;
  command?: string;
  title?: string;
  exitCode?: number;
}

export const TerminalVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as TerminalData;
  const output = d.output;
  const command = d.command;
  const title = d.title;
  const exitCode = d.exitCode || 0;
  const [copied, copy] = useCopy();
  const [expanded, setExpanded] = useState(false);
  const copyOutput = useCallback(() => copy(output || ''), [output, copy]);

  const renderAnsi = (text: string) => {
    if (!text) return '';
    const ansiRegex = new RegExp(String.fromCharCode(27) + '\\[([0-9;]*)m', 'g');
    const parts: { text: string; bold?: boolean; color?: string }[] = [];
    let lastIdx = 0;
    let currentStyle: { bold?: boolean; color?: string } = {};

    const addPart = (t: string) => {
      if (t) parts.push({ text: t, ...currentStyle });
    };

    let match;
    while ((match = ansiRegex.exec(text)) !== null) {
      addPart(text.slice(lastIdx, match.index));
      lastIdx = match.index + match[0].length;
      const codes = match[1] ? match[1].split(';').map(Number) : [0];
      for (const code of codes) {
        if (code === 0) currentStyle = {};
        else if (code === 1) currentStyle.bold = true;
        else if (code >= 30 && code <= 37) {
          const ansiColors = ['#666', '#e74c3c', '#27ae60', '#f39c12', '#3498db', '#9b59b6', '#1abc9c', '#ecf0f1'];
          currentStyle.color = ansiColors[code - 30];
        } else if (code >= 90 && code <= 97) {
          const brightColors = ['#999', '#ff6b6b', '#51cf66', '#ffd43b', '#74c0fc', '#cc5de8', '#22b8cf', '#f8f9fa'];
          currentStyle.color = brightColors[code - 90];
        }
      }
    }
    addPart(text.slice(lastIdx));

    return parts.map((p, i) => (
      <span key={i} style={{ fontWeight: p.bold ? 700 : 400, color: p.color || 'var(--gia-muted)' }}>{p.text}</span>
    ));
  };

  return (
    <VisualCard title={title || 'Terminal Output'} onCopy={copyOutput} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="rounded-lg overflow-hidden" style={{ background: '#0d0d14', maxHeight: expanded ? '600px' : '200px', overflowY: 'auto' }}>
        {command && (
          <div className="px-3 py-1.5 text-[9px] font-mono" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--gia-muted-2)' }}>
            $ {command}
          </div>
        )}
        <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--gia-muted)' }}>
          {renderAnsi(output || '')}
        </pre>
        {exitCode !== 0 && (
          <div className="px-3 py-1 text-[9px] font-mono" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
            Exit code: {exitCode}
          </div>
        )}
      </div>
    </VisualCard>
  );
};
