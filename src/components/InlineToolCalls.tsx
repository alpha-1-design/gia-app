import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { ToolIcon } from './ToolIcons';
import { TOOL_LABELS } from '../utils/toolLabels';
import type { ProtocolProposal } from '../types/protocol';
import { rendererRegistry } from '../services/mcp/RendererRegistry';

const STATUS_LABELS: Record<string, string> = {
  send_whatsapp: 'WhatsApp message prepared', send_email: 'Email composed',
  send_sms: 'SMS ready', make_phone_call: 'Phone dialer opened',
  share: 'Content shared', clipboard: 'Clipboard updated',
  vibrate: 'Device vibrated', screen_brightness: 'Brightness adjusted',
  device_info: 'Device info retrieved', get_contacts: 'Contacts fetched',
  open_url: 'URL opened', web_search: 'Search completed',
  web_scrape: 'Page fetched', http_request: 'Request completed',
};

const TOOL_COLORS: Record<string, string> = {
  send_whatsapp: '#25D366', send_email: '#ea4335', send_sms: '#3b82f6',
  make_phone_call: '#22c55e', share: '#a855f7', clipboard: '#f59e0b',
  vibrate: '#ec4899', screen_brightness: '#f97316', device_info: '#06b6d4',
  get_contacts: '#8b5cf6', open_url: '#6366f1', web_search: '#3b82f6',
  web_scrape: '#10b981', http_request: '#ec4899',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const toolColor = (type: string) => TOOL_COLORS[type] || '#a855f7';

const ProtocolCard: React.FC<{ protocol: ProtocolProposal; idx: number }> = ({ protocol, idx }) => {
  const [expandInput, setExpandInput] = useState(false);
  const [expandOutput, setExpandOutput] = useState(false);

  const color = toolColor(protocol.type);
  const isCompleted = protocol.state === 'completed';
  const duration = protocol.createdAt && protocol.completedAt
    ? formatDuration(protocol.completedAt - protocol.createdAt)
    : null;

  return (
    <motion.div
      key={protocol.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: idx * 0.05 }}
      layout
      className="my-1 rounded-xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}06, ${color}02)`,
        border: `1px solid ${color}18`,
      }}
    >
      <div className="p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
              style={{
                background: `linear-gradient(135deg, ${color}18, ${color}08)`,
              }}
            >
              <ToolIcon toolId={protocol.type} size={15} color={color} animated={false} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--gia-text)' }}>
                  {TOOL_LABELS[protocol.type] || protocol.type}
                </p>
                <p className="text-[9px] truncate" style={{ color: 'var(--gia-muted)' }}>
                  {protocol.summary}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {duration && (
                  <span className="font-mono text-[9px] tabular-nums" style={{ color: 'var(--gia-muted-2)' }}>
                    {duration}
                  </span>
                )}
                <span className="ml-auto shrink-0">
                  <span className="flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: `${isCompleted ? '#22c55e' : '#ef4444'}12`, color: isCompleted ? '#22c55e' : '#ef4444' }}>
                    <CheckCircle2 size={9} />
                    {isCompleted ? 'Done' : 'Failed'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Input args (collapsible) */}
        {protocol.args && Object.keys(protocol.args).length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setExpandInput(!expandInput)}
              className="flex items-center gap-1.5 text-[9px] font-medium opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--gia-muted)' }}
            >
              {expandInput ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 9 12 15 6 9"/></svg>}
              {expandInput ? 'Hide input' : 'Show input'} ({Object.keys(protocol.args).length} param{Object.keys(protocol.args).length !== 1 ? 's' : ''})
            </button>
            {expandInput && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[9px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg mt-1 max-h-32 overflow-y-auto"
                style={{
                  background: 'var(--gia-surface-2)',
                  color: 'var(--gia-muted)',
                  border: '1px solid var(--gia-border)',
                }}
              >
                {JSON.stringify(protocol.args, null, 2)}
              </motion.pre>
            )}
          </div>
        )}

        {/* Result display */}
        {(protocol.structuredResult || protocol.result) && !protocol.error && (
          <div className="pt-1">
            <button
              onClick={() => setExpandOutput(!expandOutput)}
              className="flex items-center gap-1.5 text-[9px] font-medium transition-opacity"
              style={{ color: toolColor(protocol.type), opacity: 0.8 }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{expandOutput ? <polyline points="6 9 12 15 18 9"/> : <polyline points="18 9 12 15 6 9"/>}</svg>
              Result
            </button>
            {expandOutput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {protocol.structuredResult && (
                  <div
                    id={`mcp-result-${protocol.id}`}
                    className="mcp-result-container"
                    ref={(el) => {
                      if (el && protocol.structuredResult) {
                        const items = Array.isArray(protocol.structuredResult) ? protocol.structuredResult : [protocol.structuredResult];
                        for (const item of items) {
                          const container = document.createElement('div');
                          rendererRegistry.render(item, container);
                          el.appendChild(container);
                        }
                      }
                    }}
                  />
                )}
                {!protocol.structuredResult && (
                  <motion.pre
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg mt-1 max-h-40 overflow-y-auto"
                    style={{
                      background: 'var(--gia-surface-2)',
                      color: 'var(--gia-muted)',
                      border: '1px solid var(--gia-border)',
                    }}
                  >
                    {protocol.result}
                  </motion.pre>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Error display */}
        {protocol.error && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg mt-1 max-h-24 overflow-y-auto"
            style={{
              background: 'rgba(239,68,68,0.06)',
              color: '#f87171',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {protocol.error}
          </motion.pre>
        )}

        {/* Completion status */}
        {protocol.state === 'completed' && (
          <motion.div
            className="flex items-center gap-1.5 text-[9px]"
            style={{ color: toolColor(protocol.type) }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <CheckCircle2 size={10} />
            {STATUS_LABELS[protocol.type] || 'Completed'}
          </motion.div>
        )}

        {protocol.state === 'failed' && (
          <motion.div
            className="flex items-center gap-1.5 text-[9px]"
            style={{ color: '#ef4444' }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Action failed
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

interface InlineToolCallsProps {
  protocols: ProtocolProposal[];
  className?: string;
}

const InlineToolCalls: React.FC<InlineToolCallsProps> = ({ protocols, className = '' }) => {
  const completedProtocols = protocols
    .filter(p => p.state === 'completed' || p.state === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt);

  if (completedProtocols.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={`mt-3 flex flex-col gap-1.5 ${className}`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--gia-muted)' }}>
        Tools used ({completedProtocols.length})
      </p>
      <div className="space-y-1">
        {completedProtocols.map((protocol, idx) => (
          <ProtocolCard key={protocol.id} protocol={protocol} idx={idx} />
        ))}
      </div>
    </motion.div>
  );
};

export default InlineToolCalls;
