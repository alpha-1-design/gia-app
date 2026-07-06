import React, { useEffect, useRef, useState } from 'react';
import {
  Brain, Search, Globe, FileText, MapPin, ImageIcon,
  ChevronDown, ChevronRight, Loader, Network, Terminal, Archive,
  Zap, CheckCircle, AlertCircle, Activity,
} from 'lucide-react';
import { useGiaStore } from '../store/useGiaStore';
import GiaIcon from './GiaIcon';

interface ThinkingPanelProps {
  thoughts: string;
  isLive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const ICON_MAP: [RegExp, React.ReactNode][] = [
  [/search|looking|finding/i, <Search size={10} />],
  [/code|run|execut|terminal/i, <Terminal size={10} />],
  [/compile|build|compil/i, <Zap size={10} />],
  [/fetch|url|read.?page|page.?content|navigat/i, <Globe size={10} />],
  [/file|write|save|directory/i, <FileText size={10} />],
  [/map|location|place/i, <MapPin size={10} />],
  [/image|generate|picture|draw/i, <ImageIcon size={10} />],
  [/propos|wait|confirm|clarif/i, <Loader size={10} />],
  [/neura|knowledge|entity|graph|connection/i, <Network size={10} />],
  [/zip|archive|compress/i, <Archive size={10} />],
  [/http|api|request|response|endpoint/i, <Activity size={10} />],
  [/✅|success|complete|done/i, <CheckCircle size={10} />],
  [/⚠️|fail|error|retry/i, <AlertCircle size={10} />],
];

const thoughtIcon = (t: string): React.ReactNode | null => {
  for (const [re, icon] of ICON_MAP) {
    if (re.test(t)) return icon;
  }
  return null;
};

const entityTagColor = (type: string): string | null => {
  const t = type.toLowerCase();
  if (t === 'person' || t === 'people') return '#60a5fa';
  if (t === 'project') return '#34d399';
  if (t === 'concept' || t === 'idea') return '#c084fc';
  if (t === 'location' || t === 'place') return '#f59e0b';
  if (t === 'tool' || t === 'technology') return '#f472b6';
  if (t === 'event') return '#fb923c';
  return null;
};

const renderLine = (line: string, i: number, isLive: boolean) => {
  const isSubThought = line.startsWith('  · ') || line.startsWith('    ');
  const isObservation = line.startsWith('OBSERVATION:');
  const isToolFailed = line.startsWith('TOOL FAILED');

  let color: string;
  if (line.startsWith('⚠️')) color = '#f59e0b';
  else if (line.startsWith('✅') || line.startsWith('OBSERVATION: Success')) color = '#34d399';
  else if (isToolFailed) color = '#f87171';
  else if (isSubThought) color = isLive ? '#8b7cf7' : '#a08050';
  else color = isLive ? '#c4b5fd' : '#d4a574';

  const icon = isSubThought ? null : thoughtIcon(line);

  const inner = (
    <span className="font-mono" style={{ whiteSpace: 'pre-wrap' }}>
      {line.split(/(\([^)]+\))/g).map((part, j) => {
        const tagColor = entityTagColor(part.replace(/[()]/g, ''));
        if (tagColor) {
          return <span key={j} style={{ color: tagColor, fontWeight: 600 }}>{part}</span>;
        }
        if (part.startsWith('"') && part.endsWith('"')) {
          return <span key={j} style={{ color: isLive ? '#a78bfa' : '#e2a84b', fontStyle: 'italic' }}>{part}</span>;
        }
        return part;
      })}
    </span>
  );

  if (isObservation) {
    const summary = line.length > 100 ? line.slice(0, 97) + '…' : line;
    return (
      <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed"
        style={{ color, opacity: 0.65 }}>
        <CheckCircle size={10} className="mt-0.5 shrink-0" />
        <span className="font-mono">{summary}</span>
      </div>
    );
  }

  return (
    <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed"
      style={{
        color,
        opacity: isToolFailed ? 0.9 : isSubThought ? 0.7 : 1,
        paddingLeft: isSubThought ? 16 : 0,
      }}>
      {icon && <span className="mt-0.5 shrink-0" style={{ opacity: 0.55 }}>{icon}</span>}
      {inner}
    </div>
  );
};

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  thoughts, isLive, isExpanded, onToggle,
}) => {
  const extThinking = useGiaStore(s => s.extThinking);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showProgress, setShowProgress] = useState(true);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isLive]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (!isLive) {
      t = setTimeout(() => setShowProgress(false), 600);
    } else {
      setShowProgress(true);
    }
    return () => clearTimeout(t);
  }, [isLive]);

  if (!thoughts && !isLive) return null;

  const lines = thoughts.split('\n').filter(Boolean);
  const accent = isLive ? '#a855f7' : '#f59e0b';

  return (
    <div className="mt-2 rounded-xl overflow-hidden transition-all duration-300"
      style={{
        border: `1px solid ${isLive ? 'rgba(168,85,247,0.2)' : 'rgba(251,191,36,0.12)'}`,
        background: isLive
          ? 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.03))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(217,119,6,0.02))',
        boxShadow: isLive ? '0 0 20px rgba(168,85,247,0.08)' : 'none',
      }}>
      {/* Animated progress bar */}
      {showProgress && (
        <div className="h-0.5 w-full overflow-hidden" style={{ background: isLive ? 'rgba(168,85,247,0.08)' : 'transparent' }}>
          {isLive && (
            <div className="h-full rounded-full animate-pulse"
              style={{
                width: '40%',
                background: 'linear-gradient(90deg, #a855f7, #6366f1, #a855f7)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          )}
        </div>
      )}

      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
        style={{ color: accent }}
      >
        <Brain size={12} />
        <span className="text-[11px] font-medium flex-1">
          {isLive ? (
            <span className="flex items-center gap-1.5">
              Thinking
              {extThinking
                ? <GiaIcon size={12} animate color={accent} speed={1.3} />
                : <span className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="thinking-dot"
                        style={{
                          animationDelay: `${i * 0.16}s`,
                          background: accent,
                          width: 4, height: 4, borderRadius: '50%', display: 'inline-block',
                          animation: 'thinking-pulse 1.2s ease-in-out infinite',
                        }}
                      />
                    ))}
                  </span>
              }
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
          {lines.map((line, i) => renderLine(line, i, isLive))}
          {isLive && (extThinking
            ? <GiaIcon size={11} animate color={accent} className="ml-0.5" speed={1.4} />
            : <span className="animate-pulse ml-0.5 text-[11px]" style={{ color: accent }}>▋</span>
          )}
        </div>
      )}
    </div>
  );
};
