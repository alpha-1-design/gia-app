import React, { useState, useEffect } from 'react';
import { FileText, Image, Code, File, X, Download, Loader2, AlertCircle } from 'lucide-react';
import PDFService from '../services/PDFService';

interface Props {
  name: string;
  type: string;
  content: string;
  onClose?: () => void;
}

const EXT_PREVIEW: Record<string, { icon: React.ReactNode; lang: string }> = {
  txt: { icon: <FileText size={14} />, lang: 'text' },
  md: { icon: <FileText size={14} />, lang: 'markdown' },
  json: { icon: <Code size={14} />, lang: 'json' },
  js: { icon: <Code size={14} />, lang: 'javascript' },
  ts: { icon: <Code size={14} />, lang: 'typescript' },
  tsx: { icon: <Code size={14} />, lang: 'typescript' },
  py: { icon: <Code size={14} />, lang: 'python' },
  html: { icon: <Code size={14} />, lang: 'html' },
  css: { icon: <Code size={14} />, lang: 'css' },
  csv: { icon: <FileText size={14} />, lang: 'csv' },
  pdf: { icon: <FileText size={14} />, lang: '' },
};

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const PreviewCard: React.FC<{ file: File | { name: string; type: string; data: string }; preview?: string }> = ({ file, preview }) => {
  const [expanded, setExpanded] = useState(false);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ext = getExt(file.name);
  const meta = EXT_PREVIEW[ext] || { icon: <File size={14} />, lang: '' };

  useEffect(() => {
    if (ext !== 'pdf' || !expanded) return;
    setLoading(true);
    const load = async () => {
      try {
        const buf = file instanceof File ? await file.arrayBuffer() : new Uint8Array(atob(file.data.split(',')[1] || file.data).split('').map(c => c.charCodeAt(0))).buffer;
        const fakeFile = new File([buf], file.name, { type: 'application/pdf' });
        const text = await PDFService.extractText(fakeFile);
        setExtracted(text.slice(0, 3000));
      } catch { setExtracted('Could not extract text from PDF.'); }
      setLoading(false);
    };
    load();
  }, [ext, expanded, file]);

  if (!expanded) {
    return (
      <div onClick={() => setExpanded(true)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[10px] cursor-pointer transition-all hover:opacity-80" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
        {preview ? <img src={preview} alt="" className="w-6 h-6 rounded object-cover" /> : <span style={{ color: 'var(--gia-muted)' }}>{meta.icon}</span>}
        <span className="truncate max-w-[120px]" style={{ color: 'var(--gia-text)' }}>{file.name}</span>
        <span className="text-[8px] shrink-0" style={{ color: 'var(--gia-muted-2)' }}>Preview</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden mt-1" style={{ border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'var(--gia-surface-3)' }}>
        <div className="flex items-center gap-2">
          {preview ? <img src={preview} alt="" className="w-5 h-5 rounded object-cover" /> : <span style={{ color: 'var(--gia-muted)' }}>{meta.icon}</span>}
          <span className="text-[10px] font-medium" style={{ color: 'var(--gia-text)' }}>{file.name}</span>
        </div>
        <button onClick={() => setExpanded(false)} className="p-0.5 rounded" style={{ color: 'var(--gia-muted)' }}><X size={11} /></button>
      </div>
      {ext === 'pdf' ? (
        <div className="p-3 max-h-48 overflow-y-auto text-[11px] leading-relaxed font-mono" style={{ background: '#0d0d14', color: 'var(--gia-muted)' }}>
          {loading ? <div className="flex items-center gap-2"><Loader2 size={11} className="animate-spin" /> Extracting text...</div> : extracted || 'No text extracted.'}
        </div>
      ) : meta.lang ? (
        <pre className="p-3 max-h-48 overflow-y-auto text-[11px] leading-relaxed font-mono" style={{ background: '#0d0d14', color: 'var(--gia-muted)' }}>
          <code>{file instanceof File ? `[Binary file: ${file.type}]` : file.data.slice(0, 5000)}</code>
        </pre>
      ) : (
        <div className="p-6 flex flex-col items-center gap-2" style={{ color: 'var(--gia-muted-2)' }}>
          <FileText size={20} />
          <span className="text-[10px]">Preview not available for this file type</span>
        </div>
      )}
    </div>
  );
};

export default PreviewCard;
