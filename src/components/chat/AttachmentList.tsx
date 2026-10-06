import React from 'react';
import { X } from 'lucide-react';
import type { Attachment } from '../../hooks/useFileAttachments';
import FilePreview from '../FilePreview';

interface AttachmentListProps {
  attachments: Attachment[];
  removeAttachment: (idx: number) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, removeAttachment }) => {
  if (attachments.length === 0) return null;
  return (
    <div className="mb-2.5 flex flex-wrap items-start gap-2">
      {attachments.map((att, idx) => (
        <div key={`${att.name}-${idx}`} className="flex min-w-0 items-start gap-1">
          <FilePreview attachment={att} />
          <button
            type="button"
            onClick={() => removeAttachment(idx)}
            aria-label={`Remove ${att.name}`}
            className="mt-2 rounded p-1 text-zinc-500 transition-colors hover:text-rose-400"
          >
            <span className="sr-only">Remove</span>
            <X size={10} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
