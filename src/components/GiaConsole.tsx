import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Terminal, X, Brain, CheckCircle2, AlertCircle, Zap, ChevronRight } from 'lucide-react';

interface ConsoleLog {
  id: string;
  timestamp: number;
  type: 'thought' | 'tool' | 'result' | 'error';
  content: string;
}

interface GiaConsoleProps {
  logs: ConsoleLog[];
  isVisible: boolean;
  onClose: () => void;
}

const GiaConsole: React.FC<GiaConsoleProps> = ({ logs, isVisible, onClose }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isVisible) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'thought': return <Brain size={12} className="text-amber-400" />;
      case 'tool': return <Terminal size={12} className="text-violet-400" />;
      case 'result': return <CheckCircle2 size={12} className="text-emerald-400" />;
      case 'error': return <AlertCircle size={12} className="text-rose-400" />;
      default: return <ChevronRight size={12} style={{ color: 'var(--gia-muted-2)' }} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'thought': return 'REASONING';
      case 'tool': return 'EXECUTING';
      case 'result': return 'SUCCESS';
      case 'error': return 'FAILURE';
      default: return 'INFO';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="fixed bottom-24 left-4 right-4 z-50 h-[45vh] max-h-[500px] flex flex-col rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
      style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', backdropFilter: 'blur(30px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'var(--gia-surface-2)', borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--gia-muted)' }}>Gia Neural OS Console</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--gia-muted-2)' }}>
          <X size={14} />
        </button>
      </div>

      {/* Logs View */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono [&::-webkit-scrollbar]:hidden">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20">
            <Zap size={32} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-[10px] uppercase tracking-widest">No neural activity detected</span>
          </div>
        ) : (
          logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                {getIcon(log.type)}
                <span className={`text-[9px] font-bold tracking-widest ${
                  log.type === 'thought' ? 'text-amber-500' : 
                  log.type === 'tool' ? 'text-violet-500' : 
                  log.type === 'error' ? 'text-rose-500' : 'text-emerald-500'
                }`}>
                  {getTypeLabel(log.type)}
                </span>
                <span className="text-[8px] font-bold ml-auto uppercase tracking-tighter" style={{ color: 'var(--gia-muted-2)' }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="pl-5 border-l ml-1.5" style={{ borderColor: 'var(--gia-border)' }}>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono break-all" style={{ color: 'var(--gia-muted)' }}>
                  {log.content}
                </pre>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer / Status */}
      <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: '1px solid var(--gia-border)', background: 'var(--gia-surface-2)' }}>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--gia-muted-2)' }}>Autonomous Core Active</span>
      </div>
    </motion.div>
  );
};

export default GiaConsole;
