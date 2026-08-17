import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, Cpu, Brain, CheckCircle, AlertCircle, AlertTriangle,
  ChevronDown, ChevronRight, Clock,
  Search, TrendingUp, Lightbulb, GitMerge, Compass, Zap, Code2,
  Navigation2, ShieldCheck, Thermometer, Sun, Heart, BookOpen,
  Handshake, GraduationCap, Eye, CircleDot, Share2,
} from 'lucide-react';
import { useGiaStore } from '../../store/useGiaStore';
import GiaIcon from '../GiaIcon';
import BottomSheet from '../ui/BottomSheet';

type LogType = 'thought' | 'tool' | 'result' | 'error';

interface EngineSheetProps {
  open: boolean;
  onClose: () => void;
}

type SectionMeta = {
  type: LogType;
  label: string;
  color: string;
  glow: string;
  icon: React.ReactNode;
};

const sectionMeta: Record<LogType, SectionMeta> = {
  thought: { type: 'thought', label: 'THOUGHT', color: '#a855f7', glow: 'rgba(168,85,247,0.12)', icon: <Brain size={13} /> },
  tool:    { type: 'tool',    label: 'ACTION',  color: '#f59e0b', glow: 'rgba(245,158,11,0.12)',  icon: <Cpu size={13} /> },
  result:  { type: 'result',  label: 'RESULT',  color: '#34d399', glow: 'rgba(52,211,153,0.10)',  icon: <CheckCircle size={13} /> },
  error:   { type: 'error',   label: 'ERROR',   color: '#f87171', glow: 'rgba(248,113,113,0.12)', icon: <AlertCircle size={13} /> },
};

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Atlas: <Search size={14} />,
  Nova: <TrendingUp size={14} />,
  Onyx: <AlertTriangle size={14} />,
  Flux: <Lightbulb size={14} />,
  Vex: <GitMerge size={14} />,
  Astra: <Compass size={14} />,
  Bolt: <Zap size={14} />,
  Cipher: <Code2 size={14} />,
  Drift: <Navigation2 size={14} />,
  Ember: <ShieldCheck size={14} />,
  Frost: <Thermometer size={14} />,
  Glimmer: <Sun size={14} />,
  Haven: <Heart size={14} />,
  Iris: <BookOpen size={14} />,
  Jade: <Handshake size={14} />,
  Krypton: <Brain size={14} />,
  Lumen: <GraduationCap size={14} />,
  Mist: <Eye size={14} />,
  Nyx: <CircleDot size={14} />,
  Orbit: <Share2 size={14} />,
};

const AGENT_COLORS: Record<string, string> = {
  Atlas: '#a855f7', Nova: '#f59e0b', Onyx: '#3b82f6', Flux: '#ec4899',
  Vex: '#10b981', Astra: '#6366f1', Bolt: '#ef4444', Cipher: '#14b8a6',
  Drift: '#f97316', Ember: '#06b6d4', Frost: '#84cc16', Glimmer: '#d946ef',
  Haven: '#0ea5e9', Iris: '#eab308', Jade: '#22d3ee', Krypton: '#8b5cf6',
  Lumen: '#fb923c', Mist: '#2dd4bf', Nyx: '#a78bfa', Orbit: '#fbbf24',
};

function agentStatusFromLogs(logs: { type: string; content: string }[]): { name: string; status: string }[] {
  const agentStatus: Record<string, string> = {};
  const spawnMatch = logs.find(l => l.content.startsWith('Spawning'));
  if (spawnMatch) {
    const names = [...spawnMatch.content.matchAll(/(\w+)\s*\(/g)].map(m => m[1]);
    for (const n of names) agentStatus[n] = 'spawning';
  }
  for (const l of logs) {
    const m = l.content.match(/^\[(\w+)\]/);
    if (!m) continue;
    const name = m[1];
    if (l.type === 'tool') agentStatus[name] = 'running';
    else if (l.type === 'result') agentStatus[name] = 'completed';
    else if (l.type === 'error') agentStatus[name] = 'failed';
  }
  return Object.entries(agentStatus).map(([name, status]) => ({ name, status }));
}

function LogCard({ log, meta }: { log: { id: string; timestamp: number; type: LogType; content: string }; meta: SectionMeta }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = log.content.length > 120;

  const preview = isLong ? log.content.slice(0, 120) + '…' : log.content;

  return (
    <motion.div
      layout
      className="rounded-lg overflow-hidden transition-all"
      style={{
        background: expanded ? `${meta.glow}` : 'transparent',
        border: expanded ? `1px solid ${meta.color}22` : '1px solid transparent',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:opacity-80 transition-opacity"
        style={{ cursor: isLong || expanded ? 'pointer' : 'default' }}
      >
        <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-semibold tracking-wider" style={{ color: meta.color }}>
              {meta.label}
            </span>
            <Clock size={8} style={{ color: 'var(--gia-muted-3)' }} />
            <span className="text-[8px]" style={{ color: 'var(--gia-muted-3)' }}>
              {new Date(log.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words" style={{ color: log.type === 'error' ? '#f87171' : 'var(--gia-text)', opacity: log.type === 'result' ? 0.75 : 0.95 }}>
            {(expanded || !isLong) ? log.content : preview}
          </p>
        </div>
        {isLong && (
          <span className="mt-0.5 shrink-0" style={{ color: 'var(--gia-muted-2)' }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </button>
    </motion.div>
  );
}

export const EngineSheet: React.FC<EngineSheetProps> = ({ open, onClose }) => {
  const consoleLogs = useGiaStore(s => s.consoleLogs);
  const currentTool = useGiaStore(s => s.currentTool);
  const thinkingPhase = useGiaStore(s => s.thinkingPhase);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLogs, open]);

  const hasContent = consoleLogs.length > 0;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="75vh" zIndex={50}>
      <div
        className="relative overflow-hidden"
        style={{
          background: 'var(--gia-surface-2)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--gia-border)' }}>
          <div className="flex items-center gap-2.5">
            <GiaIcon size={18} animate color="#a855f7" speed={1.2} />
            <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>
                      Agent Activity
                    </span>
                    {hasContent && (
                      <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                        {thinkingPhase}
                      </span>
                    )}
                    {currentTool && (
                      <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        {currentTool}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasContent && (
                    <span className="text-[9px] flex items-center gap-1" style={{ color: 'var(--gia-muted)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors" style={{ color: 'var(--gia-muted)' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Sub-Agent Panel */}
              {(() => {
                const agents = agentStatusFromLogs(consoleLogs);
                if (agents.length === 0) return null;
                return (
                  <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b" style={{ borderColor: 'var(--gia-border)' }}>
                    {agents.map(a => {
                      const color = AGENT_COLORS[a.name] || '#a855f7';
                      const icon = AGENT_ICONS[a.name] || <Brain size={14} />;
                      const isActive = a.status === 'running' || a.status === 'spawning';
                      return (
                        <motion.div
                          key={a.name}
                          layout
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shrink-0"
                          style={{
                            background: isActive ? `${color}12` : `${color}08`,
                            border: `1px solid ${isActive ? color + '30' : color + '10'}`,
                          }}
                        >
                          <span style={{ color }}>{icon}</span>
                          <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: 'var(--gia-text)' }}>
                            {a.name}
                          </span>
                          {a.status === 'running' && (
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                          )}
                          {a.status === 'completed' && (
                            <CheckCircle size={10} style={{ color: '#34d399' }} />
                          )}
                          {a.status === 'failed' && (
                            <AlertCircle size={10} style={{ color: '#f87171' }} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Timeline feed */}
              <div
                ref={scrollRef}
                className="overflow-y-auto py-2"
                style={{ maxHeight: 'calc(75vh - 52px)' }}
              >
                {!hasContent ? (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <GiaIcon size={36} animate color="#a855f7" speed={0.8} />
                    <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
                      Waiting for GIA to start working…
                    </p>
                  </div>
                ) : (
                  <div className="relative px-4 pb-2">
                    {/* Timeline spine */}
                    <div className="absolute left-[27px] top-2 bottom-2 w-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

                    {consoleLogs.map((log, i) => {
                      const meta = sectionMeta[log.type];
                      const prev = i > 0 ? consoleLogs[i - 1] : null;
                      const showSectionHeader = !prev || prev.type !== log.type;

                      const agentMatch = log.content.match(/^\[(\w+)\]/);
                      const agentIcon = agentMatch ? AGENT_ICONS[agentMatch[1]] : null;
                      const agentColor = agentMatch ? AGENT_COLORS[agentMatch[1]] : null;
                      const displayIcon = agentIcon || meta.icon;
                      const displayColor = agentColor || meta.color;

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.3) }}
                        >
                          {showSectionHeader && (
                            <div className="flex items-center gap-2.5 py-1.5 pt-3">
                              <div
                                className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 z-10"
                                style={{ background: meta.glow, color: meta.color }}
                              >
                                {meta.icon}
                              </div>
                              <span className="text-[9px] font-semibold tracking-wider" style={{ color: meta.color }}>
                                {meta.label}
                              </span>
                            </div>
                          )}
                          <div className="ml-[34px] pb-1">
                            <LogCard log={log} meta={{ ...meta, icon: displayIcon, color: displayColor }} />
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Bottom live indicator */}
                    <div className="flex items-center gap-2 py-2 ml-[34px]">
                      <GiaIcon size={10} animate color="#a855f7" speed={1.5} />
                      <span className="text-[9px]" style={{ color: 'var(--gia-muted)' }}>Processing…</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
    </BottomSheet>
  );
};

export default EngineSheet;
