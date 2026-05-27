import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, CheckCircle2, XCircle, Clock, Loader2, AlertCircle, Play, X, Edit3 } from 'lucide-react';
import { useProtocolStore } from '../store/useProtocolStore';
import { ProtocolProposal, PROTOCOL_META } from '../types/protocol';

interface ProtocolCardProps {
  protocol: ProtocolProposal;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  compact?: boolean;
}

const STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  proposed:  { label: 'Proposed',  color: '#3b82f6', icon: <Clock size={12} /> },
  confirmed: { label: 'Confirmed', color: '#eab308', icon: <Play size={12} /> },
  executing: { label: 'Executing', color: '#a855f7', icon: <Loader2 size={12} className="animate-spin" /> },
  completed: { label: 'Completed', color: '#22c55e', icon: <CheckCircle2 size={12} /> },
  failed:    { label: 'Failed',    color: '#ef4444', icon: <AlertCircle size={12} /> },
  rejected:  { label: 'Rejected',  color: '#6b7280', icon: <XCircle size={12} /> },
  modified:  { label: 'Modified',  color: '#eab308', icon: <Edit3 size={12} /> },
};

const ProtocolCard: React.FC<ProtocolCardProps> = ({ protocol, onConfirm, onReject, compact }) => {
  const { confirm, reject } = useProtocolStore();
  const meta = PROTOCOL_META[protocol.type] || PROTOCOL_META.custom;
  const stateCfg = STATE_CONFIG[protocol.state] || STATE_CONFIG.proposed;
  const isPending = protocol.state === 'proposed';
  const isDone = protocol.state === 'completed' || protocol.state === 'failed' || protocol.state === 'rejected';
  const isActive = protocol.state === 'executing';

  const handleConfirm = () => {
    if (onConfirm) onConfirm(protocol.id);
    else confirm(protocol.id);
  };

  const handleReject = () => {
    if (onReject) onReject(protocol.id);
    else reject(protocol.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="my-2 rounded-xl overflow-hidden border"
      style={{
        borderColor: isPending ? `${meta.color}33` : 'var(--gia-border)',
        background: isPending ? `${meta.color}06` : 'var(--gia-surface)',
      }}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: `${meta.color}18`, color: meta.color }}
            >
              {meta.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--gia-text)' }}>
                {meta.label}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--gia-muted)' }}>
                {protocol.summary}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-lg shrink-0"
            style={{ background: `${stateCfg.color}15`, color: stateCfg.color }}
          >
            {stateCfg.icon}
            {stateCfg.label}
          </div>
        </div>

        {!compact && protocol.description && (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--gia-muted-2)' }}>
            {protocol.description}
          </p>
        )}

        {!compact && protocol.trace && protocol.trace.length > 0 && (
          <div className="space-y-0.5 pl-1">
            {protocol.trace.map((t, i) => (
              <p key={i} className="text-[10px] text-zinc-600 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />
                {t}
              </p>
            ))}
          </div>
        )}

        {protocol.result && (
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg max-h-24 overflow-y-auto"
            style={{ background: 'var(--gia-surface-2)', color: 'var(--gia-muted)', border: '1px solid var(--gia-border)' }}>
            {protocol.result.length > 300 ? protocol.result.slice(0, 300) + '...' : protocol.result}
          </pre>
        )}

        {protocol.error && (
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg max-h-16 overflow-y-auto"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {protocol.error}
          </pre>
        )}

        {!compact && protocol.sources && protocol.sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold" style={{ color: 'var(--gia-muted)' }}>Sources</p>
            {protocol.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                className="block text-[10px] truncate hover:underline"
                style={{ color: '#3b82f6' }}>
                [{i + 1}] {s.title}
              </a>
            ))}
          </div>
        )}

        {isPending && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#22c55e', color: 'white' }}
            >
              <Play size={10} /> Execute
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <X size={10} /> Reject
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex items-center gap-2 text-[10px]" style={{ color: meta.color }}>
            <Loader2 size={10} className="animate-spin" />
            Executing...
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(ProtocolCard);
