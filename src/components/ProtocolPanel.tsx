import React from 'react';
import { motion } from 'motion/react';
import { Activity, X, Trash2 } from 'lucide-react';
import { useProtocolStore } from '../store/useProtocolStore';
import ProtocolCard from './ProtocolCard';

interface ProtocolPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const ProtocolPanel: React.FC<ProtocolPanelProps> = ({ isVisible, onClose }) => {
  const { consoleProtocols, clearConsoleProtocols } = useProtocolStore();

  if (!isVisible) return null;

  const active = consoleProtocols.filter(p => p.state === 'proposed' || p.state === 'executing');
  const done = consoleProtocols.filter(p => p.state === 'completed' || p.state === 'failed' || p.state === 'rejected');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 10 }}
      className="fixed bottom-24 left-4 right-4 z-50 h-[45vh] max-h-[500px] flex flex-col rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
      style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)', backdropFilter: 'blur(30px)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: 'var(--gia-surface-2)', borderBottom: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--gia-muted)' }}>Protocols</span>
          {active.length > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
              {active.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {consoleProtocols.length > 0 && (
            <button onClick={clearConsoleProtocols} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--gia-muted-2)' }}>
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--gia-muted-2)' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden">
        {consoleProtocols.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20">
            <Activity size={32} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-[10px] uppercase tracking-widest">No protocol activity</span>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gia-muted)' }}>Active</p>
                {active.map(p => (
                  <ProtocolCard key={p.id} protocol={p} />
                ))}
              </div>
            )}
            {done.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gia-muted)' }}>History</p>
                {done.map(p => (
                  <ProtocolCard key={p.id} protocol={p} compact />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: '1px solid var(--gia-border)', background: 'var(--gia-surface-2)' }}>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <span className="text-[9px] font-medium uppercase tracking-widest" style={{ color: 'var(--gia-muted-2)' }}>
          {consoleProtocols.length} protocol{consoleProtocols.length !== 1 ? 's' : ''} recorded
        </span>
      </div>
    </motion.div>
  );
};

export default React.memo(ProtocolPanel);
