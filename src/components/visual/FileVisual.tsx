import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Download, FileText, FileArchive, File, Loader2 } from 'lucide-react';
import { VisualCard } from './common';
import { useCopy } from './useCopy';
import { triggerDownload } from '../../services/tools/helpers';

interface FilePreviewData {
  url?: string;
  name?: string;
  format?: string;
  files?: string[];
}

function fileName(name?: string) {
  return name || 'file';
}

function formatLabel(format?: string) {
  switch (format) {
    case 'pdf': return 'PDF Document';
    case 'pptx': return 'PowerPoint';
    case 'docx': return 'Word Document';
    case 'zip': return 'ZIP Archive';
    default: return 'File';
  }
}

const PdfViewer: React.FC<{ url: string }> = ({ url }) => {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(false);
  }, [url]);

  const download = useCallback(() => {
    fetch(url).then(r => r.blob()).then(b => triggerDownload(b, 'document.pdf'));
  }, [url]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>PDF Preview</span>
        <button onClick={download} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:opacity-80" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-muted)' }}>
          <Download size={10} /> Download
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: 'var(--gia-muted-2)' }}>
          <Loader2 size={16} className="animate-spin mr-2" /> Loading PDF...
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full rounded-lg"
          style={{ height: '400px', border: '1px solid var(--gia-border)', background: 'white' }}
          title="PDF Preview"
        />
      )}
    </div>
  );
};

const PptxViewer: React.FC<{ url: string; name?: string }> = ({ url, name }) => {
  const download = useCallback(() => {
    fetch(url).then(r => r.blob()).then(b => triggerDownload(b, fileName(name)));
  }, [url, name]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>PowerPoint Preview</span>
        <button onClick={download} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:opacity-80" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-muted)' }}>
          <Download size={10} /> Download
        </button>
      </div>
      <div className="rounded-lg p-6 flex flex-col items-center gap-3" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
        <FileText size={32} style={{ color: '#d14424' }} />
        <span className="text-xs text-center" style={{ color: 'var(--gia-muted)' }}>
          {fileName(name)}
        </span>
        <a
          href={url}
          download={name}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
          style={{ background: '#d14424', color: 'white' }}
        >
          <Download size={12} className="inline mr-1.5" /> Download & Open
        </a>
      </div>
    </div>
  );
};

const DocxViewer: React.FC<{ url: string; name?: string }> = ({ url, name }) => {
  const download = useCallback(() => {
    fetch(url).then(r => r.blob()).then(b => triggerDownload(b, fileName(name)));
  }, [url, name]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>Word Document Preview</span>
        <button onClick={download} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:opacity-80" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-muted)' }}>
          <Download size={10} /> Download
        </button>
      </div>
      <div className="rounded-lg p-6 flex flex-col items-center gap-3" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
        <FileText size={32} style={{ color: '#2b579a' }} />
        <span className="text-xs text-center" style={{ color: 'var(--gia-muted)' }}>
          {fileName(name)}
        </span>
        <a
          href={url}
          download={name}
          className="px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90"
          style={{ background: '#2b579a', color: 'white' }}
        >
          <Download size={12} className="inline mr-1.5" /> Download & Open
        </a>
      </div>
    </div>
  );
};

const ZipViewer: React.FC<{ url: string; name?: string; files?: string[] }> = ({ url, name, files }) => {
  const download = useCallback(() => {
    fetch(url).then(r => r.blob()).then(b => triggerDownload(b, fileName(name)));
  }, [url, name]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>ZIP Archive</span>
        <button onClick={download} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors hover:opacity-80" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-muted)' }}>
          <Download size={10} /> Download
        </button>
      </div>
      <div className="rounded-lg p-4" style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}>
        {files && files.length > 0 ? (
          <div>
            <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--gia-muted-2)' }}>Contents ({files.length} files)</div>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-[11px]" style={{ color: 'var(--gia-muted)' }}>
                <File size={11} />
                {f}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <FileArchive size={24} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-[11px]" style={{ color: 'var(--gia-muted)' }}>{fileName(name)}</span>
            <a href={url} download={name} className="px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-90" style={{ background: 'var(--gia-surface-3)', color: 'var(--gia-text)' }}>
              <Download size={10} className="inline mr-1" /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export const FileVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const d = data as FilePreviewData;
  const { url, format, name, files } = d;
  const [copied, copy] = useCopy();

  const copyUrl = useCallback(() => {
    if (url) copy(url);
  }, [url, copy]);

  const title = `${formatLabel(format)}: ${fileName(name)}`;

  if (!url) return null;

  const viewer = format === 'pdf' ? <PdfViewer url={url} /> :
    format === 'pptx' ? <PptxViewer url={url} name={name} /> :
    format === 'docx' ? <DocxViewer url={url} name={name} /> :
    format === 'zip' ? <ZipViewer url={url} name={name} files={files} /> : null;

  if (!viewer) return null;

  return (
    <VisualCard title={title} onCopy={copyUrl} copied={copied}>
      {viewer}
    </VisualCard>
  );
};
