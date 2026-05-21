import React, { useEffect, useRef } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingPanelProps {
  thoughts: string;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  thoughts, isLive, isExpanded, onToggle
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isLive]);

  if (!thoughts && !isLive) return null;

  return (
    <div className="mt-2.5 rounded-xl overflow-hidden transition-all"
      style={{
        border: '1px solid rgba(251,191,36,0.15)',
        background: 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(217,119,6,0.02))',
        boxShadow: isLive ? '0 0 12px rgba(251,191,36,0.06)' : 'none',
      }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-500/5 transition-colors"
        style={{ color: '#f59e0b' }}
      >
        <Brain size={12} />
        <span className="text-[11px] font-medium flex-1">
          {isLive ? (
            <span className="flex items-center gap-1.5">
              Reasoning
              <span className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="thinking-dot"
                    style={{ animationDelay: `${i * 0.16}s`, background: '#f59e0b' }} />
                ))}
              </span>
            </span>
          ) : (
            `${isExpanded ? 'Hide' : 'Show'} reasoning`
          )}
        </span>
        {!isLive && (
          <>
            <span className="text-[10px] opacity-50">
              {thoughts.split(' ').length} words
            </span>
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </>
        )}
      </button>

      {(isExpanded || isLive) && thoughts && (
        <div
          ref={scrollRef}
          className="px-3 pb-3 text-[11px] leading-relaxed font-mono max-h-40 overflow-y-auto scroll-smooth"
          style={{
            color: '#d4a574',
            whiteSpace: 'pre-wrap',
          }}
        >
          {thoughts}
          {isLive && <span className="animate-pulse ml-0.5" style={{ color: '#f59e0b' }}>▋</span>}
        </div>
      )}
    </div>
  );
};
