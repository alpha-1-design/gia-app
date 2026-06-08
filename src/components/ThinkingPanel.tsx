import React, { useEffect, useRef } from 'react';
import { Brain, Search, Code, Globe, FileText, MapPin, ImageIcon, ChevronDown, ChevronRight, Loader } from 'lucide-react';

interface ThinkingPanelProps {
  thoughts: string;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const thoughtIcon = (t: string) => {
  const lower = t.toLowerCase();
  if (lower.includes('search') || lower.includes('looking') || lower.includes('finding')) return <Search size={10} />;
  if (lower.includes('code') || lower.includes('run') || lower.includes('execut') || lower.includes('terminal')) return <Code size={10} />;
  if (lower.includes('fetch') || lower.includes('url') || lower.includes('read') || lower.includes('page')) return <Globe size={10} />;
  if (lower.includes('file') || lower.includes('write') || lower.includes('save')) return <FileText size={10} />;
  if (lower.includes('map') || lower.includes('location') || lower.includes('place')) return <MapPin size={10} />;
  if (lower.includes('image') || lower.includes('generate') || lower.includes('picture')) return <ImageIcon size={10} />;
  if (lower.includes('propos') || lower.includes('wait') || lower.includes('confirm')) return <Loader size={10} />;
  return null;
};

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

  const lines = thoughts.split('\n').filter(Boolean);

  return (
    <div className="mt-2 rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isLive ? 'rgba(168,85,247,0.2)' : 'rgba(251,191,36,0.12)'}`,
        background: isLive
          ? 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.03))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(217,119,6,0.02))',
        boxShadow: isLive ? '0 0 16px rgba(168,85,247,0.08)' : 'none',
      }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
        style={{ color: isLive ? '#a855f7' : '#f59e0b' }}
      >
        <Brain size={12} />
        <span className="text-[11px] font-medium flex-1">
          {isLive ? (
            <span className="flex items-center gap-1.5">
              Thinking
              <span className="flex gap-0.5">
                {[0,1,2].map(i => (
                  <span key={i} className="thinking-dot"
                    style={{
                      animationDelay: `${i * 0.16}s`,
                      background: isLive ? '#a855f7' : '#f59e0b',
                      width: 4, height: 4, borderRadius: '50%', display: 'inline-block',
                      animation: 'thinking-pulse 1.2s ease-in-out infinite',
                    }} />
                ))}
              </span>
            </span>
          ) : (
            `${isExpanded ? 'Hide' : 'Show'} reasoning  (${thoughts.split(' ').length} words)`
          )}
        </span>
        {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {(isExpanded || isLive) && thoughts && (
        <div
          ref={scrollRef}
          className="px-3 pb-3 max-h-44 overflow-y-auto scroll-smooth space-y-0.5"
        >
          {lines.map((line, i) => {
            const icon = thoughtIcon(line);
            return (
              <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed"
                style={{
                  color: line.startsWith('⚠️') ? '#f59e0b' : line.startsWith('✅') || line.startsWith('OBSERVATION: Success') ? '#34d399' : line.startsWith('TOOL FAILED') ? '#f87171' : isLive ? '#c4b5fd' : '#d4a574',
                  opacity: line.startsWith('OBSERVATION:') ? 0.7 : 1,
                }}>
                {icon && <span className="mt-0.5 shrink-0 opacity-60">{icon}</span>}
                <span className="font-mono">{line}</span>
              </div>
            );
          })}
          {isLive && <span className="animate-pulse ml-0.5 text-[11px]" style={{ color: '#a855f7' }}>▋</span>}
        </div>
      )}
    </div>
  );
};
