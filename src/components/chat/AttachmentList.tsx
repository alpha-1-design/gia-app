import React from 'react';
import { Paperclip, X } from 'lucide-react';
import type { Attachment } from '../../hooks/useChatState';

interface AttachmentListProps {
  attachments: Attachment[];
  removeAttachment: (idx: number) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, removeAttachment }) => {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2.5">
      {attachments.map((att, idx) => (
        <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] bg-zinc-800 border border-zinc-700/50">
          {att.preview ? (
            <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <Paperclip size={10} className="text-zinc-400 shrink-0" />
          )}
          <span className="text-zinc-300 truncate max-w-[100px]">{att.name}</span>
          <button onClick={() => removeAttachment(idx)} className="text-zinc-600 hover:text-rose-400 ml-0.5">
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
};
