import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Copy, Check, Maximize2, Minimize2, ChevronRight, ChevronDown, Sun, Moon, Wind, Droplets, TrendingUp, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Play, Square } from 'lucide-react';

const CHART_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#8b5cf6'];
const COPY_FEEDBACK_DURATION = 1500;

interface VisualBlock {
  type: string;
  data: any;
}

const parseVisualBlock = (code: string): VisualBlock | { error: string } => {
  try {
    const parsed = JSON.parse(code);
    if (!parsed.type || !parsed.data) return { error: 'Visual block must have "type" and "data" fields.' };
    return parsed;
  } catch {
    return { error: 'Invalid JSON in visual block.' };
  }
};

const useCopy = (): [boolean, (text: string) => void] => {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
  }, []);
  return [copied, copy];
};

const CollapsibleSection: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)' }}>
        <span>{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="p-3" style={{ background: 'var(--gia-surface)' }}>{children}</div>}
    </div>
  );
};

const VisualHeader: React.FC<{ title?: string; onCopy: () => void; copied: boolean; onExpand?: () => void; expanded?: boolean }> = ({ title, onCopy, copied, onExpand, expanded }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-t-xl" style={{ background: 'var(--gia-surface-3)', borderBottom: '1px solid var(--gia-border)' }}>
    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>{title || 'Visualization'}</span>
    <div className="flex items-center gap-1">
      {onExpand && (
        <button onClick={onExpand} className="p-1 rounded transition-colors hover:bg-white/5" style={{ color: 'var(--gia-muted-2)' }}>
          {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>
      )}
      <button onClick={onCopy} className="p-1 rounded transition-colors hover:bg-white/5" style={{ color: 'var(--gia-muted-2)' }}>
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  </div>
);

const VisualCard: React.FC<{ title?: string; expanded?: boolean; onToggle?: () => void; onCopy: () => void; copied: boolean; children: React.ReactNode }> = ({ title, expanded, onToggle, onCopy, copied, children }) => (
  <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)' }}>
    <VisualHeader title={title} onCopy={onCopy} copied={copied} onExpand={onToggle} expanded={expanded} />
    <div className="p-4" style={{ background: 'var(--gia-surface)' }}>
      {children}
    </div>
  </div>
);

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, copy] = useCopy();
  return (
    <button onClick={() => copy(text)} className="flex items-center gap-1 px-2 py-1 rounded text-[9px] transition-colors hover:bg-white/5" style={{ color: 'var(--gia-muted-2)' }}>
      {copied ? <Check size={9} /> : <Copy size={9} />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

interface DownsamplerProps {
  data: any[];
  xKey: string;
  yKey: string;
  maxPoints?: number;
  children: (downsampled: any[]) => React.ReactNode;
}

const Downsampler: React.FC<DownsamplerProps> = ({ data, xKey, yKey, maxPoints = 50, children }) => {
  const downsampled = useMemo(() => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }, [data, maxPoints]);
  return <>{children(downsampled)}</>;
};

const ChartVisual: React.FC<{ data: any }> = ({ data }) => {
  const { type = 'bar', labels, datasets, title, xLabel, yLabel } = data;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();

  const chartData = useMemo(() => {
    if (datasets && labels) {
      return labels.map((label: string, i: number) => {
        const row: any = { name: label };
        Object.keys(datasets).forEach(key => { row[key] = datasets[key][i]; });
        return row;
      });
    }
    return data.rows || data.data || [];
  }, [datasets, labels, data]);

  const keys = useMemo(() => {
    if (datasets) return Object.keys(datasets);
    if (chartData.length > 0) return Object.keys(chartData[0]).filter(k => k !== 'name');
    return ['value'];
  }, [datasets, chartData]);

  const copyTable = useCallback(() => {
    const header = ['name', ...keys].join('\t');
    const rows = chartData.map((r: any) => [r.name, ...keys.map(k => r[k])].join('\t')).join('\n');
    copy(`${header}\n${rows}`);
  }, [chartData, keys, copy]);

  const containerHeight = expanded ? 400 : 220;

  if (!chartData.length) {
    return <div className="text-xs p-4 text-center" style={{ color: 'var(--gia-muted-2)' }}>No data to visualize</div>;
  }

  const commonProps = { width: '100%' as const, height: containerHeight };

  return (
    <VisualCard title={title || `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`} expanded={expanded} onToggle={() => setExpanded(!expanded)} onCopy={copyTable} copied={copied}>
      <div style={{ width: '100%', height: containerHeight }}>
        <ResponsiveContainer {...commonProps}>
          {type === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />)}
            </AreaChart>
          ) : type === 'pie' ? (
            <PieChart>
              <Pie data={chartData} dataKey={keys[0]} nameKey="name" cx="50%" cy="50%" outerRadius={expanded ? 130 : 70} label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={true}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gia-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--gia-muted)' }} />
              <RechartsTooltip contentStyle={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {keys.map((k, i) => <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </VisualCard>
  );
};

const MindMapVisual: React.FC<{ data: any }> = ({ data }) => {
  const { root, nodes, title } = data;
  const [expanded, setExpanded] = useState(true);
  const [copied, copy] = useCopy();
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => {
    if (root) return root;
    return { name: title || 'Root', children: nodes || [] };
  }, [root, nodes, title]);

  const copyData = useCallback(() => copy(JSON.stringify(tree, null, 2)), [tree, copy]);

  const layout = useMemo(() => {
    const positions: { name: string; x: number; y: number; color?: string; children?: any[] }[] = [];
    const depth = (node: any, level: number, offset: number): number => {
      const x = level * 180;
      const y = offset;
      positions.push({ name: node.name, x, y, color: node.color, children: node.children });
      if (!node.children?.length) return offset + 60;
      let currentY = offset;
      node.children.forEach((child: any) => {
        currentY = depth(child, level + 1, currentY);
      });
      const centerY = (offset + currentY - 60) / 2;
      const existing = positions.find(p => p.x === x && p.y === y);
      if (existing) existing.y = centerY;
      return currentY;
    };
    depth(tree, 0, 50);
    return positions;
  }, [tree]);

  const svgWidth = Math.max(400, (layout.length > 0 ? Math.max(...layout.map(p => p.x)) : 200) + 200);
  const svgHeight = Math.max(300, (layout.length > 0 ? Math.max(...layout.map(p => p.y)) : 200) + 100);

  return (
    <VisualCard title={title || 'Mind Map'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><ZoomIn size={11} /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><ZoomOut size={11} /></button>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="p-1 rounded" style={{ color: 'var(--gia-muted-2)', background: 'var(--gia-surface-2)' }}><RotateCcw size={11} /></button>
        <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{Math.round(scale * 100)}%</span>
      </div>
      <div ref={svgRef} className="overflow-auto rounded-lg" style={{ background: '#0d0d14', maxHeight: expanded ? '600px' : '250px', cursor: 'grab' }}>
        <svg width={svgWidth * scale} height={svgHeight * scale} style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <g transform={`scale(${scale})`}>
            {layout.map((node, i) => {
              const color = node.color || CHART_COLORS[i % CHART_COLORS.length];
              return (
                <g key={i}>
                  {node.children?.map((child: any, ci: number) => {
                    const childPos = layout.find(p => p.name === child.name);
                    if (!childPos) return null;
                    const childColor = child.color || CHART_COLORS[(i + ci + 1) % CHART_COLORS.length];
                    return (
                      <line key={`l-${i}-${ci}`} x1={node.x + 60} y1={node.y} x2={childPos.x} y2={childPos.y} stroke={childColor} strokeWidth="1.5" opacity="0.4" />
                    );
                  })}
                  <circle cx={node.x} cy={node.y} r="24" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
                  <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize="10" fontWeight="600">
                    {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </VisualCard>
  );
};

const DiffVisual: React.FC<{ data: any }> = ({ data }) => {
  const { old: oldText, new: newText, title, context = 3 } = data;
  const [copied, copy] = useCopy();
  const [view, setView] = useState<'unified' | 'split'>('unified');
  const [expanded, setExpanded] = useState(false);

  const diffLines = useMemo(() => {
    if (!oldText || !newText) return [];
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLen = Math.max(oldLines.length, newLines.length);
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
    const oldWords = oldStr.split(/(\s+)/);
    const newWords = newStr.split(/(\s+)/);
    const maxLen = Math.max(oldWords.length, newWords.length);

    if (oldStr === newStr) {
      return <span style={{ color: 'var(--gia-text)' }}>{oldStr}</span>;
    }

    const segments: { text: string; changed: boolean }[] = [];
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

const DataTableVisual: React.FC<{ data: any }> = ({ data }) => {
  const { columns, rows, title, pageSize = 10 } = data;
  const [copied, copy] = useCopy();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const cols = useMemo(() => columns || (rows?.length ? Object.keys(rows[0]) : []), [columns, rows]);

  const processed = useMemo(() => {
    let result = [...(rows || [])];
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter((r: any) => cols.some((c: string) => String(r[c] || '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return result;
  }, [rows, sortKey, sortDir, filter, cols]);

  const totalPages = Math.ceil(processed.length / pageSize);
  const pageRows = processed.slice(page * pageSize, (page + 1) * pageSize);

  const copyTable = useCallback(() => {
    const header = cols.join('\t');
    const body = processed.map((r: any) => cols.map((c: string) => r[c] ?? '').join('\t')).join('\n');
    copy(`${header}\n${body}`);
  }, [cols, processed, copy]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  if (!rows?.length) return <div className="text-xs p-4 text-center" style={{ color: 'var(--gia-muted-2)' }}>No data</div>;

  return (
    <VisualCard title={title || 'Data Table'} onCopy={copyTable} copied={copied}>
      <div className="flex items-center gap-2 mb-3">
        <input value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} placeholder="Filter rows..." className="flex-1 bg-transparent text-[10px] outline-none px-2 py-1.5 rounded-lg" style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-text)', border: '1px solid var(--gia-border)' }} />
        <span className="text-[9px] shrink-0" style={{ color: 'var(--gia-muted-2)' }}>{processed.length} rows</span>
      </div>
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--gia-border)' }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ background: 'var(--gia-surface-3)' }}>
              {cols.map((c: string) => (
                <th key={c} onClick={() => toggleSort(c)} className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap" style={{ color: 'var(--gia-muted)', borderBottom: '1px solid var(--gia-border)' }}>
                  {c} {sortKey === c ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row: any, ri: number) => (
              <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--gia-surface-2)' : 'transparent' }}>
                {cols.map((c: string) => (
                  <td key={c} className="px-3 py-1.5" style={{ color: 'var(--gia-text)', borderBottom: '1px solid var(--gia-border)' }}>{row[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="text-[9px] px-2 py-1 rounded" style={{ color: page === 0 ? 'var(--gia-muted-2)' : 'var(--gia-muted)', background: 'var(--gia-surface-2)' }}>← Prev</button>
          <span className="text-[9px]" style={{ color: 'var(--gia-muted-2)' }}>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-[9px] px-2 py-1 rounded" style={{ color: page >= totalPages - 1 ? 'var(--gia-muted-2)' : 'var(--gia-muted)', background: 'var(--gia-surface-2)' }}>Next →</button>
        </div>
      )}
    </VisualCard>
  );
};

const ImageGalleryVisual: React.FC<{ data: any }> = ({ data }) => {
  const { images, title, columns = 3 } = data;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const copyData = useCallback(() => copy(images.map((i: any) => i.url || i).join('\n')), [images, copy]);

  if (!images?.length) return null;

  return (
    <VisualCard title={title || 'Gallery'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(columns, images.length)}, 1fr)` }}>
        {images.map((img: any, i: number) => {
          const url = img.url || img;
          const caption = img.caption || '';
          return (
            <div key={i} onClick={() => setViewerIdx(i)} className="relative rounded-lg overflow-hidden cursor-pointer group" style={{ border: '1px solid var(--gia-border)', aspectRatio: '1' }}>
              <img src={url} alt={caption} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              {caption && <div className="absolute bottom-0 left-0 right-0 p-1.5 text-[8px]" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white' }}>{caption}</div>}
            </div>
          );
        })}
      </div>
      {viewerIdx !== null && (
        <div onClick={() => setViewerIdx(null)} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={images[viewerIdx].url || images[viewerIdx]} alt="" className="max-w-full max-h-[85vh] rounded-xl" style={{ border: '1px solid var(--gia-border)' }} />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2">
                <button onClick={() => setViewerIdx(i => Math.max(0, i! - 1))} disabled={viewerIdx === 0} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)', color: viewerIdx === 0 ? 'var(--gia-muted-2)' : 'white' }}>← Prev</button>
                <button onClick={() => setViewerIdx(i => Math.min(images.length - 1, i! + 1))} disabled={viewerIdx >= images.length - 1} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)', color: viewerIdx >= images.length - 1 ? 'var(--gia-muted-2)' : 'white' }}>Next →</button>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>{viewerIdx + 1} / {images.length}</span>
            </div>
          </div>
        </div>
      )}
    </VisualCard>
  );
};

const TimelineVisual: React.FC<{ data: any }> = ({ data }) => {
  const { events, title } = data;
  const [expanded, setExpanded] = useState(false);
  const [copied, copy] = useCopy();
  const copyData = useCallback(() => copy(JSON.stringify(events, null, 2)), [events, copy]);

  if (!events?.length) return null;

  const sorted = [...events].sort((a, b) => new Date(a.date || a.time || a.year).getTime() - new Date(b.date || b.time || b.year).getTime());

  return (
    <VisualCard title={title || 'Timeline'} onCopy={copyData} copied={copied} expanded={expanded} onToggle={() => setExpanded(!expanded)}>
      <div className="relative pl-6" style={{ maxHeight: expanded ? '600px' : '250px', overflowY: 'auto' }}>
        <div className="absolute left-2.5 top-0 bottom-0 w-0.5" style={{ background: 'linear-gradient(to bottom, #a855f7, #3b82f6)' }} />
        {sorted.map((event: any, i: number) => (
          <div key={i} className="relative pb-4 last:pb-0">
            <div className="absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2" style={{ background: 'var(--gia-bg)', borderColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <div className="ml-2">
              <span className="text-[9px] font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{event.date || event.time || event.year}</span>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--gia-text)' }}>{event.title || event.name}</p>
              {event.description && <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{event.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
};

const TerminalVisual: React.FC<{ data: any }> = ({ data }) => {
  const { output, command, title, exitCode = 0 } = data;
  const [copied, copy] = useCopy();
  const [expanded, setExpanded] = useState(false);
  const copyOutput = useCallback(() => copy(output || ''), [output, copy]);

  const renderAnsi = (text: string) => {
    if (!text) return '';
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
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

interface WidgetDef {
  type: string;
  data: { label: string; value: string | number; unit?: string; change?: number; icon?: string; color?: string };
}

const WIDGET_ICONS: Record<string, React.ReactNode> = {
  temperature: <Sun size={14} />,
  humidity: <Droplets size={14} />,
  wind: <Wind size={14} />,
  trend: <TrendingUp size={14} />,
};

const MetricWidgetVisual: React.FC<{ data: WidgetDef[] | WidgetDef }> = ({ data }) => {
  const [copied, copy] = useCopy();
  const widgets = Array.isArray(data) ? data : [data];
  const copyData = useCallback(() => copy(JSON.stringify(widgets, null, 2)), [widgets, copy]);

  return (
    <VisualCard title="Metrics" onCopy={copyData} copied={copied}>
      <div className="grid grid-cols-2 gap-3">
        {widgets.map((w, i) => {
          const d = w.data || w;
          const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {WIDGET_ICONS[d.icon || ''] && <span style={{ color }}>{WIDGET_ICONS[d.icon || '']}</span>}
                <span className="text-[9px] font-medium" style={{ color: 'var(--gia-muted-2)' }}>{d.label}</span>
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--gia-text)' }}>
                {d.value}{d.unit && <span className="text-[10px] ml-0.5" style={{ color: 'var(--gia-muted)' }}>{d.unit}</span>}
              </div>
              {d.change !== undefined && (
                <span className="text-[9px]" style={{ color: d.change >= 0 ? '#34d399' : '#f87171' }}>
                  {d.change >= 0 ? '↑' : '↓'} {Math.abs(d.change)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </VisualCard>
  );
};

interface WaveformVisualProps {
  data: { isPlaying?: boolean; onPlay?: () => void; onStop?: () => void };
}

const WaveformVisual: React.FC<WaveformVisualProps> = ({ data }) => {
  const { isPlaying, onPlay, onStop } = data;
  const [copied, copy] = useCopy();
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying || !barsRef.current) return;
    const bars = barsRef.current.querySelectorAll('.wave-bar');
    const anim = () => {
      bars.forEach((bar, i) => {
        const h = 10 + Math.random() * 30;
        (bar as HTMLElement).style.height = `${h}px`;
      });
      if (isPlaying) requestAnimationFrame(anim);
    };
    const raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <VisualCard title="Audio Waveform" onCopy={() => copy('')} copied={copied}>
      <div className="flex items-center gap-3">
        <button onClick={isPlaying ? onStop : onPlay} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
          {isPlaying ? <Square size={12} /> : <Play size={12} />}
        </button>
        <div ref={barsRef} className="flex-1 flex items-center gap-0.5 h-10">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="wave-bar rounded-full" style={{ width: '4px', height: '12px', background: isPlaying ? '#a855f7' : 'var(--gia-border)', transition: 'height 0.1s ease', opacity: isPlaying ? 0.4 + Math.random() * 0.6 : 0.3 }} />
          ))}
        </div>
      </div>
    </VisualCard>
  );
};

const DocumentOutlineVisual: React.FC<{ data: any }> = ({ data }) => {
  const { headings, title } = data;
  const [copied, copy] = useCopy();
  if (!headings?.length) return null;

  const copyData = useCallback(() => copy(headings.map((h: any) => `${'  '.repeat((h.level || 1) - 1)}${h.text}`).join('\n')), [headings, copy]);

  return (
    <VisualCard title={title || 'Document Outline'} onCopy={copyData} copied={copied}>
      <nav>
        {headings.map((h: any, i: number) => (
          <div key={i} className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${((h.level || 1) - 1) * 16}px` }}>
            <div className="w-1 h-1 rounded-full" style={{ background: CHART_COLORS[(h.level || 1) % CHART_COLORS.length] }} />
            <span className="text-[11px] cursor-pointer hover:opacity-80" style={{ color: 'var(--gia-muted)', fontWeight: h.level <= 2 ? 600 : 400 }}>{h.text}</span>
          </div>
        ))}
      </nav>
    </VisualCard>
  );
};

const ErrorVisual: React.FC<{ message: string }> = ({ message }) => (
  <div className="my-3 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
    {message}
  </div>
);

const VisualRenderer: React.FC<{ code: string }> = ({ code }) => {
  const parsed = useMemo(() => parseVisualBlock(code), [code]);

  if ('error' in parsed) return <ErrorVisual message={parsed.error} />;

  const { type, data } = parsed;

  switch (type) {
    case 'chart':
      return <ChartVisual data={data} />;
    case 'mindmap':
    case 'mind_map':
    case 'mind-map':
      return <MindMapVisual data={data} />;
    case 'diff':
    case 'code_diff':
    case 'code-diff':
      return <DiffVisual data={data} />;
    case 'table':
    case 'data_table':
    case 'data-table':
      return <DataTableVisual data={data} />;
    case 'gallery':
    case 'image_gallery':
    case 'image-gallery':
      return <ImageGalleryVisual data={data} />;
    case 'timeline':
      return <TimelineVisual data={data} />;
    case 'terminal':
    case 'terminal_output':
    case 'terminal-output':
      return <TerminalVisual data={data} />;
    case 'widget':
    case 'metric':
    case 'metrics':
      return <MetricWidgetVisual data={data} />;
    case 'waveform':
    case 'audio':
      return <WaveformVisual data={data} />;
    case 'outline':
    case 'document_outline':
    case 'toc':
      return <DocumentOutlineVisual data={data} />;
    default:
      return <ErrorVisual message={`Unknown visual type: "${type}". Supported: chart, mindmap, diff, table, gallery, timeline, terminal, widget, waveform, outline`} />;
  }
};

export default React.memo(VisualRenderer);
