import React, { useState, useMemo, useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface DiffData {
  old?: string;
  new?: string;
  title?: string;
}

export const DiffVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as DiffData;
  const oldText = d.old;
  const newText = d.new;
  const title = d.title;
  const [copied, copy] = useCopy();
  const [view, setView] = useState<'unified' | 'split'>('unified');
  const [expanded, setExpanded] = useState(false);

  const diffLines = useMemo(() => {
    if (!oldText || !newText) return [];
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const lines: { type: 'same' | 'add' | 'remove'; oldLine: string; newLine: string; oldNum?: number; newNum?: number }[] = [];
    let oldIdx = 0, newIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] === newLines[newIdx]) {
        lines.push({ type: 'same', oldLine: oldLines[oldIdx], newLine: newLines[newIdx], oldNum: oldIdx + 1, newNum: newIdx + 1 });
        oldIdx++; newIdx++;
      } else {
        if (oldIdx < oldLines.length && (newIdx >= newLines.length || oldLines[oldIdx] !== newLines[newIdx])) {
          lines.push({ type: 'remove', oldLine: oldLines[oldIdx], newLine: '', oldNum: oldIdx + 1 });
          oldIdx++;
        } else if (newIdx < newLines.length) {
          lines.push({ type: 'add', oldLine: '', newLine: newLines[newIdx], newNum: newIdx + 1 });
          newIdx++;
        }
      }
    }
    return lines;
  }, [oldText, newText]);

  const copyDiff = useCallback(() => copy(diffLines.map(l => `${l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' '}${l.oldLine || l.newLine}`).join('\n')), [diffLines, copy]);

  const wordDiff = (oldStr: string, newStr: string) => {
    if (!oldStr || !newStr) return null;

    if (oldStr === newStr) {
      return <span style={{ color: 'var(--gia-text)' }}>{oldStr}</span>;
    }

    let commonPrefixLen = 0, commonSuffixLen = 0;
    while (commonPrefixLen < Math.min(oldStr.length, newStr.length) && oldStr[commonPrefixLen] === newStr[commonPrefixLen]) commonPrefixLen++;
    while (commonSuffixLen < Math.min(oldStr.length - commonPrefixLen, newStr.length - commonPrefixLen) && oldStr[oldStr.length - 1 - commonSuffixLen] === newStr[newStr.length - 1 - commonSuffixLen]) commonSuffixLen++;

    const oldChanged = oldStr.slice(commonPrefixLen, oldStr.length - commonSuffixLen);
    const newChanged = newStr.slice(commonPrefixLen, newStr.length - commonSuffixLen);

    return (
      <span>
        <span>{oldStr.slice(0, commonPrefixLen)}</span>
        <span style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: '2px' }}>{oldChanged}</span>
        <span style={{ background: 'rgba(34,197,94,0.3)', color: '#86efac', borderRadius: '2px' }}>{newChanged}</span>
        <span>{oldStr.slice(oldStr.length - commonSuffixLen)}</span>
      </span>
    );
  };

  const maxLines = expanded ? diffLines.length : 30;

  return (
    <VisualCard title={title || 'Code Diff'} onCopy={copyDiff} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2 mb-3">
        {(['unified', 'split'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className="text-[9px] px-2 py-1 rounded-lg capitalize" style={{ background: view === v ? 'rgba(168,85,247,0.15)' : 'var(--gia-surface-2)', color: view === v ? '#a855f7' : 'var(--gia-muted-2)' }}>
            {v}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg" style={{ background: '#0d0d14', maxHeight: expanded ? '600px' : '200px', overflowY: 'auto' }}>
        <table className="w-full text-[10px] font-mono leading-relaxed">
          <tbody>
            {diffLines.slice(0, maxLines).map((line, i) => (
              <tr key={i} style={{ background: line.type === 'add' ? 'rgba(34,197,94,0.06)' : line.type === 'remove' ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                <td className="w-10 text-right px-2 select-none" style={{ color: 'var(--gia-muted-2)' }}>{line.oldNum || ''}</td>
                <td className="w-10 text-right px-2 select-none" style={{ color: 'var(--gia-muted-2)' }}>{line.newNum || ''}</td>
                <td className="w-4 text-center select-none" style={{ color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#f87171' : 'var(--gia-muted-2)' }}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </td>
                <td className="px-2 whitespace-pre" style={{ color: line.type === 'add' ? '#86efac' : line.type === 'remove' ? '#fca5a5' : 'var(--gia-muted)' }}>
                  {view === 'split' && line.type === 'remove' && line.newLine ? wordDiff(line.oldLine, line.newLine) : (line.oldLine || line.newLine)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {diffLines.length > 30 && !expanded && (
          <div className="text-center py-2 text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>
            +{diffLines.length - 30} more lines
          </div>
        )}
      </div>
    </VisualCard>
  );
};
