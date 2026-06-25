import React from 'react';
import { motion } from 'motion/react';

interface Props {
  count?: number;
}

const MessageSkeleton: React.FC<{ isUser: boolean }> = ({ isUser }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
    className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
  >
    <div className="w-7 h-7 rounded-full shrink-0 skeleton-pulse" style={{ borderRadius: '50%' }} />
    <div className="flex-1 min-w-0 space-y-2" style={{ maxWidth: isUser ? '70%' : '85%' }}>
      <div className="flex items-center gap-2 ml-1">
        <div className="h-2.5 w-10 rounded skeleton-pulse" />
        <div className="h-2 w-8 rounded skeleton-pulse" />
      </div>
      <div
        className="p-4 rounded-2xl space-y-2.5"
        style={{
          background: isUser ? 'rgba(168,85,247,0.05)' : 'var(--gia-surface)',
          borderTopRightRadius: isUser ? '4px' : '20px',
          borderTopLeftRadius: isUser ? '20px' : '4px',
        }}
      >
        <div className="h-3 w-full rounded skeleton-pulse" />
        <div className="h-3 w-3/4 rounded skeleton-pulse" />
        <div className="h-3 w-1/2 rounded skeleton-pulse" />
      </div>
    </div>
  </motion.div>
);

const ChatSkeleton: React.FC<Props> = ({ count = 2 }) => (
  <div className="flex flex-col gap-5 px-4 py-4">
    {Array.from({ length: count }, (_, i) => (
      <MessageSkeleton key={i} isUser={i % 2 === 0} />
    ))}
  </div>
);

export default React.memo(ChatSkeleton);
