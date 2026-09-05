import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, FileImage, Download, X, Eye, Code2, Loader2, Check } from 'lucide-react';
import PDFService from '../services/PDFService';
import type { LiveFileEdit } from '../store/useGiaStore';

interface LiveFileEditorProps {
  edit: LiveFileEdit;
  onClose: () => void;
}

function computeDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === undefined) {
      result.push({ type: 'added', text: newLine });
    } else if (newLine === undefined) {
      result.push({ type: 'removed', text: oldLine });
    } else if (oldLine === newLine) {
      result.push({ type: 'same', text: newLine });
    } else {
      result.push({ type: 'removed', text: oldLine });
      result.push({ type: 'added', text: newLine });
    }
  }
  return result;
}

function PdfViewer({ base64 }: { base64: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    PDFService.extractFromBuffer(
      (() => {
        const binaryString = atob(base64.split(',')[1] || '');
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
      })()
    ).then(text => {
      if (cancelled) return;
      const pageTexts = text.split(/\[Page \d+\]/).filter(Boolean);
      setPages(pageTexts.slice(0, 5));
      setLoading(false);
    }).catch(e => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'PDF render failed');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [base64]);

  if (loading) return <div className="flex items-center gap-2 p-4 text-[11px]" style={{ color: 'var(--gia-muted)' }}><Loader2 size={12} className="animate-spin" /> Rendering PDF…</div>;
  if (error) return <div className="p-4 text-[11px]" style={{ color: '#ef4444' }}>{error}</div>;
  return (
    <div className="p-3 space-y-2 overflow-y-auto max-h-96">
      {pages.map((p, i) => (
        <div key={i} className="p-3 rounded-lg text-[10px] font-mono whitespace-pre-wrap" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)', color: 'var(--gia-text)' }}>
          <span className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--gia-muted-2)' }}>Page {i + 1}</span>
          {p.trim()}
        </div>
      ))}
      {pages.length === 0 && <div className="p-4 text-[11px]" style={{ color: 'var(--gia-muted)' }}>No extractable text in PDF.</div>}
    </div>
  );
}

export const LiveFileEditor: React.FC<LiveFileEditorProps> = ({ edit, onClose }) => {
  const [viewMode, setViewMode] = useState<'diff' | 'preview' | 'raw'>('diff');
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isText = !edit.isPdf && ['text/', 'application/json', 'application/xml'].some(t => edit.type.startsWith(t)) || edit.name.endsWith('.txt') || edit.name.endsWith('.md') || edit.name.endsWith('.json') || edit.name.endsWith('.py') || edit.name.endsWith('.js') || edit.name.endsWith('.ts') || edit.name.endsWith('.tsx') || edit.name.endsWith('.css') || edit.name.endsWith('.html') || edit.name.endsWith('.csv') || edit.name.endsWith('.xml') || edit.name.endsWith('.yaml') || edit.name.endsWith('.yml');

  const diff = useMemo(() => isText ? computeDiff(edit.oldContent, edit.newContent) : [], [edit.oldContent, edit.newContent, isText]);
  const addedCount = diff.filter(d => d.type === 'added').length;
  const removedCount = diff.filter(d => d.type === 'removed').length;

  useEffect(() => {
    if (scrollRef.current && viewMode === 'diff') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [edit.newContent, viewMode]);

  useEffect(() => {
    setSaved(false);
  }, [edit.newContent]);

  const handleDownload = () => {
    const blob = new Blob([edit.newContent], { type: edit.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = edit.name;
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const accent = isText ? '#6366f1' : '#ec4899';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="relative w-full mb-3 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--gia-surface)',
        border: `1px solid ${accent}44`,
        boxShadow: `0 8px 40px ${accent}22, 0 0 0 1px rgba(0,0,0,0.1)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: `linear-gradient(90deg, ${accent}15, transparent)`,
          borderBottom: `1px solid ${accent}22`,
        }}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          {isText ? <FileText size={14} style={{ color: accent }} /> : <FileImage size={14} style={{ color: accent }} />}
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--gia-text)' }}>{edit.name}</p>
          <p className="text-[8px]" style={{ color: 'var(--gia-muted-2)' }}>
            {isText ? `Live editing · ${addedCount} added, ${removedCount} removed` : 'Live preview'}
            {' · '}
            <span style={{ color: accent }}>{(edit.newContent.length / 1000).toFixed(1)}K chars</span>
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--gia-muted)' }}>
          <X size={14} />
        </button>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b" style={{ borderColor: 'var(--gia-border)' }}>
        {isText ? (
          <>
            <TabButton active={viewMode === 'diff'} onClick={() => setViewMode('diff')} icon={<Code2 size={10} />} label="Diff" />
            <TabButton active={viewMode === 'raw'} onClick={() => setViewMode('raw')} icon={<FileText size={10} />} label="Raw" />
          </>
        ) : (
          <TabButton active={viewMode === 'preview'} onClick={() => setViewMode('preview')} icon={<Eye size={10} />} label="Preview" />
        )}
        <div className="ml-auto">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all"
            style={{ background: saved ? 'rgba(34,197,94,0.15)' : `${accent}15`, color: saved ? '#22c55e' : accent }}
          >
            {saved ? <Check size={10} /> : <Download size={10} />}
            {saved ? 'Saved' : 'Download'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto">
        {isText ? (
          viewMode === 'diff' ? (
            <div className="p-2 font-mono text-[10px] leading-relaxed">
              {diff.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: line.type === 'added' ? 8 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-1.5 px-1.5 py-0.5 rounded"
                  style={{
                    background: line.type === 'added' ? 'rgba(34,197,94,0.08)' : line.type === 'removed' ? 'rgba(239,68,68,0.08)' : 'transparent',
                  }}
                >
                  <span className="shrink-0 select-none w-3 text-center" style={{
                    color: line.type === 'added' ? '#22c55e' : line.type === 'removed' ? '#ef4444' : 'var(--gia-muted-3)'
                  }}>
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ''}
                  </span>
                  <span className="whitespace-pre-wrap break-all" style={{
                    color: line.type === 'added' ? '#86efac' : line.type === 'removed' ? '#fca5a5' : 'var(--gia-muted)'
                  }}>
                    {line.text || ' '}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <pre className="p-3 text-[10px] font-mono whitespace-pre-wrap" style={{ color: 'var(--gia-text)' }}>{edit.newContent}</pre>
          )
        ) : (
          viewMode === 'preview' && edit.newContent.startsWith('data:application/pdf') ? (
            <PdfViewer base64={edit.newContent} />
          ) : (
            <div className="p-4 text-[11px] text-center" style={{ color: 'var(--gia-muted)' }}>
              PDF preview available. Switch to Preview tab to see extracted content.
            </div>
          )
        )}
      </div>
    </motion.div>
  );
};

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all"
      style={{
        background: active ? 'rgba(168,85,247,0.12)' : 'transparent',
        color: active ? '#a855f7' : 'var(--gia-muted-2)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
