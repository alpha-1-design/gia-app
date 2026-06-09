import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Search, Globe, FileText, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { useSearchActivity } from '../store/useSearchActivity';

export const SourcesPanel: React.FC = () => {
  const {
    panelOpen, setPanelOpen,
    events, sources, active,
    queryCount, fetchCount,
  } = useSearchActivity();

  return (
    <AnimatePresence>
      {panelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-2xl overflow-hidden border-t border-zinc-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
            style={{ background: 'rgba(12,12,16,0.98)', backdropFilter: 'blur(20px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-zinc-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Search size={14} className="text-violet-400" />
                <span className="text-[10px] font-bold tracking-wide text-zinc-300 uppercase">Search Activity</span>
                {active && (
                  <span className="flex items-center gap-1 text-[9px] text-violet-400 font-medium">
                    <Loader2 size={9} className="animate-spin" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] text-zinc-500">
                  {queryCount} query{queryCount !== 1 ? 'ies' : 'y'} · {fetchCount} page{fetchCount !== 1 ? 's' : ''} · {sources.length} source{sources.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => setPanelOpen(false)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(70vh-80px)] p-3 space-y-2">
              {/* Activity Feed */}
              {events.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 px-1">Activity Log</p>
                  {events.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-[10px]"
                      style={{ background: ev.done ? 'rgba(255,255,255,0.02)' : 'rgba(168,85,247,0.04)' }}
                    >
                      {ev.type === 'query' && <Search size={10} className="mt-0.5 shrink-0 text-violet-400" />}
                      {ev.type === 'fetch' && <Globe size={10} className="mt-0.5 shrink-0 text-blue-400" />}
                      {ev.type === 'result' && <FileText size={10} className="mt-0.5 shrink-0 text-emerald-400" />}
                      {ev.type === 'error' && <AlertCircle size={10} className="mt-0.5 shrink-0 text-rose-400" />}
                      {ev.type === 'info' && <ChevronRight size={10} className="mt-0.5 shrink-0 text-zinc-500" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-300 leading-relaxed">{ev.message}</p>
                        {ev.url && (
                          <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-[8px] text-blue-400/70 hover:text-blue-400 truncate block mt-0.5">
                            {ev.url}
                          </a>
                        )}
                      </div>
                      {!ev.done && (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sources List */}
              {sources.length > 0 && (
                <div className="space-y-1 mt-3">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-zinc-600 px-1">
                    Sources ({sources.length})
                  </p>
                  {sources.map((src, i) => {
                    const domain = (() => { try { return new URL(src.url).hostname.replace('www.', ''); } catch { return src.url; } })();
                    return (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all hover:bg-zinc-800/50 group"
                        style={{ background: 'rgba(255,255,255,0.015)' }}
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                          alt=""
                          className="w-4 h-4 rounded mt-0.5 shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-zinc-200 group-hover:text-violet-300 transition-colors">
                            {src.title || domain}
                          </p>
                          <p className="text-[8px] text-zinc-500 mt-0.5 line-clamp-2">{src.snippet}</p>
                          <p className="text-[7px] text-zinc-600 mt-0.5 flex items-center gap-1">
                            {domain}
                            <ExternalLink size={7} />
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {events.length === 0 && sources.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-40">
                  <Search size={24} className="text-zinc-500" />
                  <p className="text-[10px] text-zinc-500">No search activity yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
