import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { ToolIcon } from './ToolIcons';
import type { ProtocolProposal } from '../types/protocol';

const STATE_CFG: Record<string, { label: string; color: string }> = {
  proposed:  { label: 'Proposed',  color: '#3b82f6' },
  confirmed: { label: 'Queued',   color: '#eab308' },
  executing: { label: 'Running',  color: '#a855f7' },
  completed: { label: 'Done',     color: '#22c55e' },
  failed:    { label: 'Failed',   color: '#ef4444' },
  rejected:  { label: 'Skipped',  color: '#6b7280' },
};

const TOOL_LABELS: Record<string, string> = {
  send_whatsapp: 'WhatsApp', send_email: 'Email', send_sms: 'SMS',
  make_phone_call: 'Phone Call', share: 'Share', clipboard: 'Clipboard',
  vibrate: 'Vibrate', screen_brightness: 'Brightness', device_info: 'Device Info',
  get_contacts: 'Contacts', open_url: 'Open URL', web_search: 'Web Search',
  web_scrape: 'Web Scrape', http_request: 'HTTP Request',
};

const STATUS_LABELS: Record<string, string> = {
  send_whatsapp: 'WhatsApp message prepared', send_email: 'Email composed',
  send_sms: 'SMS ready', make_phone_call: 'Phone dialer opened',
  share: 'Content shared', clipboard: 'Clipboard updated',
  vibrate: 'Device vibrated', screen_brightness: 'Brightness adjusted',
  device_info: 'Device info retrieved', get_contacts: 'Contacts fetched',
  open_url: 'URL opened', web_search: 'Search completed',
  web_scrape: 'Page fetched', http_request: 'Request completed',
};

interface InlineToolExecutionProps {
  protocol: ProtocolProposal;
  index?: number;
}

const InlineToolExecution: React.FC<InlineToolExecutionProps> = ({ protocol, index = 0 }) => {
  const stateCfg = STATE_CFG[protocol.state] || STATE_CFG.proposed;
  const isExecuting = protocol.state === 'executing';
  const isCompleted = protocol.state === 'completed';
  const isFailed = protocol.state === 'failed';
  const isPending = protocol.state === 'proposed' || protocol.state === 'confirmed';

  const toolColor = (() => {
    const colors: Record<string, string> = {
      send_whatsapp: '#25D366', send_email: '#ea4335', send_sms: '#3b82f6',
      make_phone_call: '#22c55e', share: '#a855f7', clipboard: '#f59e0b',
      vibrate: '#ec4899', screen_brightness: '#f97316', device_info: '#06b6d4',
      get_contacts: '#8b5cf6', open_url: '#6366f1', web_search: '#3b82f6',
      web_scrape: '#10b981', http_request: '#ec4899',
    };
    return colors[protocol.type] || '#a855f7';
  })();

  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 100 + index * 80);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96, filter: 'blur(2px)' }}
      animate={showContent ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : {}}
      transition={{ type: 'spring', stiffness: 200, damping: 20, mass: 0.8 }}
      layout
      className="my-1 rounded-xl overflow-hidden"
      style={{
        background: isPending
          ? `linear-gradient(135deg, ${toolColor}06, ${toolColor}02)`
          : isFailed
            ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))'
            : `linear-gradient(135deg, ${toolColor}04, transparent)`,
        border: '1px solid',
        borderColor: isPending
          ? `${toolColor}18`
          : isFailed
            ? 'rgba(239,68,68,0.2)'
            : isCompleted
              ? `${toolColor}15`
              : 'var(--gia-border)',
        boxShadow: isExecuting
          ? `0 0 20px ${toolColor}08, inset 0 1px 0 ${toolColor}10`
          : isCompleted
            ? `0 0 12px ${toolColor}06`
            : 'none',
      }}
    >
      {/* Glass reflection line */}
      <div className="absolute top-0 left-4 right-4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${toolColor}20, transparent)` }} />

      <div className="p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Animated icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: index * 0.08 }}
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
              style={{
                background: `linear-gradient(135deg, ${toolColor}18, ${toolColor}08)`,
                boxShadow: isExecuting ? `0 0 12px ${toolColor}25` : 'none',
              }}
            >
              <ToolIcon toolId={protocol.type} size={15} color={toolColor} animated={isExecuting || isPending} />
              {isExecuting && (
                <motion.div
                  className="absolute inset-0 rounded-lg"
                  style={{ border: `1.5px solid ${toolColor}30` }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {isCompleted && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                  style={{ background: '#22c55e' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 }}
                >
                  <CheckCircle2 size={8} className="text-white" />
                </motion.div>
              )}
              {isFailed && (
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                  <XCircle size={8} className="text-white" />
                </div>
              )}
            </motion.div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--gia-text)' }}>
                  {TOOL_LABELS[protocol.type] || protocol.type}
                </p>
                {isExecuting && (
                  <motion.span
                    className="text-[8px] font-medium px-1 py-0.5 rounded-md"
                    style={{ background: `${toolColor}15`, color: toolColor }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Executing
                  </motion.span>
                )}
              </div>
              <p className="text-[9px] truncate" style={{ color: 'var(--gia-muted)' }}>
                {protocol.summary}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <motion.div
            className="flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
            style={{ background: `${stateCfg.color}12`, color: stateCfg.color }}
            layout
          >
            {isExecuting && <Loader2 size={9} className="animate-spin" />}
            {isCompleted && <CheckCircle2 size={9} />}
            {isFailed && <XCircle size={9} />}
            {isPending && <Clock size={9} />}
            {stateCfg.label}
          </motion.div>
        </div>

        {/* Execution status line */}
        {isExecuting && (
          <motion.div
            className="flex items-center gap-1.5 text-[10px]"
            style={{ color: toolColor }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: toolColor }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            Working...
          </motion.div>
        )}

        {/* Result display */}
        <AnimatePresence>
          {protocol.result && !isFailed && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg max-h-20 overflow-y-auto"
              style={{
                background: 'var(--gia-surface-2)',
                color: 'var(--gia-muted)',
                border: '1px solid var(--gia-border)',
              }}
            >
              {protocol.result.length > 200 ? protocol.result.slice(0, 200) + '...' : protocol.result}
            </motion.pre>
          )}

          {protocol.error && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono p-2 rounded-lg max-h-16 overflow-y-auto"
              style={{
                background: 'rgba(239,68,68,0.06)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {protocol.error}
            </motion.pre>
          )}
        </AnimatePresence>

        {/* Completion status */}
        {isCompleted && (
          <motion.div
            className="flex items-center gap-1.5 text-[9px]"
            style={{ color: toolColor }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <CheckCircle2 size={10} />
            </motion.div>
            {STATUS_LABELS[protocol.type] || 'Completed'}
          </motion.div>
        )}

        {isFailed && (
          <motion.div
            className="flex items-center gap-1.5 text-[9px]"
            style={{ color: '#ef4444' }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={10} />
            Action failed
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(InlineToolExecution);
