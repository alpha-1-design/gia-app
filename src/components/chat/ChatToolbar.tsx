import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, Paperclip, Image as ImageIcon,
  Globe, Brain, Zap, Headphones, Radar,
} from 'lucide-react';

interface ChatToolbarProps {
  showTools: boolean;
  setShowTools: (val: boolean) => void;
  webSearch: boolean;
  deepSearch: boolean;
  extThinking: boolean;
  handsOff: boolean;
  voiceEnabled: boolean;
  toggleFeature: (feature: 'webSearch' | 'deepSearch' | 'extThinking' | 'handsOff' | 'listen') => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  imgRef: React.RefObject<HTMLInputElement | null>;
}

export const ChatToolbar: React.FC<ChatToolbarProps> = ({
  showTools, setShowTools,
  webSearch, deepSearch, extThinking, handsOff, voiceEnabled,
  toggleFeature, fileRef, imgRef,
}) => {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <button type="button"
        onClick={() => setShowTools(!showTools)}
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors tap-feedback"
        style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', color: 'var(--gia-muted)' }}
      >
        <motion.div animate={{ rotate: showTools ? 90 : 0 }}>
          <ChevronRight size={14} />
        </motion.div>
      </button>

      <div className="flex-1 overflow-hidden flex items-center gap-2">
        <AnimatePresence initial={false} mode="wait">
          {showTools ? (
            <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden py-1"
            >
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
              <Paperclip size={11} /> File
            </button>
            <button type="button" onClick={() => imgRef.current?.click()} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 transition-all shrink-0">
              <ImageIcon size={11} /> Photo
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />
            {[
              { label: 'Search', feature: 'webSearch' as const, icon: Globe, active: webSearch, color: '#3b82f6' },
              { label: 'DeepSearch', feature: 'deepSearch' as const, icon: Radar, active: deepSearch, color: '#22d3ee' },
              { label: 'Think', feature: 'extThinking' as const, icon: Brain, active: extThinking, color: '#f59e0b' },
              { label: 'Hands-off', feature: 'handsOff' as const, icon: Zap, active: handsOff, color: '#a855f7' },
              { label: 'Listen', feature: 'listen' as const, icon: Headphones, active: voiceEnabled, color: '#ec4899' },
            ].map((tool) => (
              <button type="button" key={tool.label} onClick={() => toggleFeature(tool.feature)} className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-xl border transition-all tap-feedback shrink-0" style={{ background: tool.active ? `${tool.color}20` : 'var(--gia-surface)', border: `1px solid ${tool.active ? `${tool.color}40` : 'var(--gia-border)'}`, color: tool.active ? tool.color : 'var(--gia-muted)', fontWeight: 500 }}>
                <tool.icon size={11} />
                {tool.label}
              </button>
            ))}
            </motion.div>

          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <div className="flex -space-x-1.5">
                {webSearch && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-blue-500/20 text-blue-400"><Globe size={10} /></div>}
                {deepSearch && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-cyan-500/20 text-cyan-400"><Radar size={10} /></div>}
                {extThinking && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-amber-500/20 text-amber-400"><Brain size={10} /></div>}
                {handsOff && <div className="w-5 h-5 rounded-full border border-zinc-900 flex items-center justify-center bg-purple-500/20 text-purple-400"><Zap size={10} /></div>}
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gia-muted)' }}>
                {(!webSearch && !deepSearch && !extThinking && !handsOff) ? 'No active tools' : 'Tools active'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
