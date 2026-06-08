import React, { useState, useMemo, useCallback } from 'react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';

interface TableData {
  columns?: string[];
  rows?: Record<string, unknown>[];
  title?: string;
  pageSize?: number;
}

export const DataTableVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as TableData;
  const columns = d.columns;
  const rows = d.rows;
  const title = d.title;
  const pageSize = d.pageSize || 10;
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
      result = result.filter((r: Record<string, unknown>) => cols.some((c: string) => String(r[c] || '').toLowerCase().includes(q)));
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
    const body = processed.map((r: Record<string, unknown>) => cols.map((c: string) => r[c] ?? '').join('\t')).join('\n');
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
                  {c} {sortKey === c ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row: Record<string, unknown>, ri: number) => (
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
