import React, { useState } from 'react';
import { AlertCircle, Code, File, FileText, X } from 'lucide-react';
import type { Attachment } from '../hooks/useFileAttachments';

const CODE_EXTENSIONS = new Set(['js', 'ts', 'tsx', 'py', 'html', 'css', 'json']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'xml', 'yaml', 'yml', 'log']);
const PREVIEW_LIMIT = 5000;

const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const FilePreview: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const [expanded, setExpanded] = useState(false);
  const extension = getExtension(attachment.name);
  const isPdf = extension === 'pdf' || attachment.type === 'application/pdf';
  const isText = CODE_EXTENSIONS.has(extension) || TEXT_EXTENSIONS.has(extension) || isPdf;
  const icon = CODE_EXTENSIONS.has(extension) ? <Code size={14} /> : <FileText size={14} />;
  const visibleContent = attachment.content.slice(0, PREVIEW_LIMIT);
  const contentWasTruncated = attachment.content.length > PREVIEW_LIMIT;

  return (
    <div className="mt-1 min-w-0">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        className="flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[10px] transition-all hover:opacity-80"
        style={{ background: 'var(--gia-surface-2)', border: '1px solid var(--gia-border)' }}
      >
        <span className="shrink-0" style={{ color: attachment.error ? '#fb7185' : 'var(--gia-muted)' }}>
          {attachment.error ? <AlertCircle size={14} /> : attachment.preview
            ? <img src={attachment.preview} alt="" className="h-5 w-5 rounded object-cover" />
            : icon}
        </span>
        <span className="max-w-[160px] truncate" style={{ color: 'var(--gia-text)' }}>{attachment.name}</span>
        <span className="shrink-0 text-[8px]" style={{ color: attachment.error ? '#fb7185' : 'var(--gia-muted-2)' }}>
          {attachment.error ? 'Needs attention' : expanded ? 'Hide preview' : 'Preview'}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 overflow-hidden rounded-xl" style={{ border: '1px solid var(--gia-border)' }}>
          <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: 'var(--gia-surface-3)' }}>
            <div className="flex min-w-0 items-center gap-2">
              {attachment.preview
                ? <img src={attachment.preview} alt="" className="h-5 w-5 rounded object-cover" />
                : <span style={{ color: 'var(--gia-muted)' }}>{attachment.error ? <AlertCircle size={13} /> : icon}</span>}
              <span className="truncate text-[10px] font-medium" style={{ color: 'var(--gia-text)' }}>{attachment.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={`Close ${attachment.name} preview`}
              className="shrink-0 rounded p-0.5"
              style={{ color: 'var(--gia-muted)' }}
            >
              <X size={11} />
            </button>
          </div>

          {attachment.error ? (
            <div role="alert" className="flex items-start gap-2 p-3 text-[10px] leading-relaxed" style={{ background: 'rgba(127,29,29,0.12)', color: '#fca5a5' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{attachment.error}</span>
            </div>
          ) : attachment.preview ? (
            <div className="flex max-h-56 justify-center overflow-auto p-3" style={{ background: '#0d0d14' }}>
              <img src={attachment.preview} alt={attachment.name} className="max-h-52 max-w-full rounded object-contain" />
            </div>
          ) : isText ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 text-[10px] leading-relaxed" style={{ background: '#0d0d14', color: 'var(--gia-muted)' }}>
              {visibleContent || (isPdf
                ? 'No selectable text was found. This may be a scanned PDF; OCR is not available in this preview.'
                : 'This file is empty.')}
              {contentWasTruncated && '\n\n[Preview limited to the first 5,000 characters.]'}
            </pre>
          ) : attachment.content ? (
            <div className="flex items-center gap-2 p-4 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
              <File size={14} />
              Text extracted from this file is available to GIA; this file type has no formatted preview.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 text-[10px]" style={{ color: 'var(--gia-muted)' }}>
              <File size={14} />
              Preview is not available for this file type.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilePreview;
