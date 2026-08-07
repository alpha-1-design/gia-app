import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Check, Copy, ChevronDown, ChevronRight, Play, Loader2, AlertCircle } from 'lucide-react';

interface ClaudeTerminalBlockProps {
  command?: string;
  language?: string;
  status: string;
  output?: string;
  error?: string;
  exitCode?: number;
  durationMs?: number;
  args?: Record<string, unknown>;
  progressLabel?: string;
}

export const ClaudeTerminalBlock: React.FC<ClaudeTerminalBlockProps> = ({
  command,
  language = 'sh',
  status,
  output,
  error,
  exitCode,
  durationMs,
  args,
  progressLabel,
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Extract command from args if needed
  const cmd = command || (args?.command as string) || (args?.code as string) || (args?.build_command as string) || 'bash';
  const lang = (language || (args?.language as string) || 'sh').toUpperCase();

  const isRunning = status === 'executing';
  const isDone = status === 'completed';
  const isFailed = status === 'failed';

  const rawOutput = (output || error || '').trim();

  const handleCopy = () => {
    if (!rawOutput) return;
    navigator.clipboard.writeText(rawOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDuration = durationMs
    ? durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`
    : null;

  return (
    <div className="my-2 rounded-xl overflow-hidden border shadow-lg transition-all"
      style={{
        background: '#09090b',
        borderColor: isRunning ? 'rgba(168,85,247,0.4)' : isFailed ? 'rgba(239,68,68,0.3)' : 'rgba(39,39,42,0.8)',
        boxShadow: isRunning ? '0 0 20px rgba(168,85,247,0.12)' : '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      {/* Top Window Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 text-xs select-none">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mac-style Window Dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px] font-semibold truncate">
            <Terminal size={13} className="text-violet-400 shrink-0" />
            <span className="text-violet-300">{lang}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300 truncate max-w-[280px] sm:max-w-[400px]" title={cmd}>
              {cmd}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {formattedDuration && (
            <span className="font-mono text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">
              {formattedDuration}
            </span>
          )}

          {/* Status Badge */}
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <Loader2 size={10} className="animate-spin text-violet-400" />
              Running
            </span>
          )}

          {isDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Check size={10} />
              Done {exitCode !== undefined ? `(${exitCode})` : ''}
            </span>
          )}

          {isFailed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
              <AlertCircle size={10} />
              Failed {exitCode !== undefined ? `(${exitCode})` : ''}
            </span>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title={expanded ? 'Collapse output' : 'Expand output'}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {/* Command prompt banner */}
      <div className="px-3 py-1.5 bg-zinc-950 border-b border-zinc-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400 truncate flex-1 pr-2">
          <span className="text-violet-400 font-bold shrink-0">$</span>
          <span className="text-zinc-200 select-all font-mono truncate">{cmd}</span>
        </div>

        {rawOutput && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800 px-2 py-1 rounded transition-colors shrink-0"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      {/* Terminal Output Screen */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative"
          >
            {isRunning && (
              <div className="px-3 py-2 bg-violet-950/20 text-violet-300 font-mono text-[11px] flex items-center gap-2 border-b border-violet-900/30">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping shrink-0" />
                <span>{progressLabel || 'Executing command in GIA terminal...'}</span>
              </div>
            )}

            <div className="p-3 bg-[#09090b] font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
              {rawOutput ? (
                <pre className="text-emerald-300/90 whitespace-pre-wrap break-words font-mono select-text">
                  {rawOutput}
                </pre>
              ) : isRunning ? (
                <div className="text-zinc-500 italic flex items-center gap-2 py-1">
                  <Play size={10} className="text-violet-400 animate-pulse" />
                  Streaming terminal stdout...
                </div>
              ) : (
                <div className="text-zinc-600 italic">
                  (command completed with no output)
                </div>
              )}
            </div>

            {/* Bottom Terminal Footer */}
            <div className="px-3 py-1 bg-zinc-950/90 border-t border-zinc-900/80 flex items-center justify-between text-[10px] font-mono text-zinc-500 select-none">
              <span>root@gia-terminal:~#</span>
              {exitCode !== undefined && (
                <span className={exitCode === 0 ? 'text-emerald-500 font-semibold' : 'text-red-400 font-semibold'}>
                  Exit code: {exitCode}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
