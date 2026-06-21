import React from 'react';
import { Shield, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';
import { useProtocolStore } from '../../store/useProtocolStore';
import { ProtocolType, PROTOCOL_META } from '../../types/protocol';
import { Switch } from '../ui/Switch';

const TYPE_GROUPS: { label: string; types: ProtocolType[] }[] = [
  {
    label: 'Safe Reads',
    types: ['web_search', 'web_fetch', 'file_read', 'environment_info', 'clarification', 'show_map'],
  },
  {
    label: 'Storage & Memory',
    types: ['file_write', 'brain_export', 'brain_import', 'zip_project', 'memory_modification'],
  },
  {
    label: 'Device Actions',
    types: ['device_action', 'notification', 'location_access', 'image_generation'],
  },
  {
    label: 'System Changes',
    types: ['code_execution', 'settings_change', 'custom'],
  },
];

export const ProtocolsApprovalsSection: React.FC = () => {
  const {
    autoConfirmTypes, fullAutonomy,
    setAutoConfirm, setFullAutonomy,
    clearConsoleProtocols, consoleProtocols,
  } = useProtocolStore();

  const activeCount = consoleProtocols.filter(p => p.state === 'proposed' || p.state === 'executing').length;
  const totalCount = consoleProtocols.length;

  return (
    <div className="gia-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className="text-violet-400" />
        <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>Protocols & Approvals</span>
      </div>

      <Switch
        checked={fullAutonomy}
        onChange={setFullAutonomy}
        label="Full Autonomy Mode"
        description="When ON, GIA can execute all tools without asking for approval. Use with caution."
        icon={<Shield size={13} />}
        accentColor="#ef4444"
      />

      {!fullAutonomy && (
        <div className="mt-3 space-y-2">
          {TYPE_GROUPS.map((group) => (
            <div key={group.label} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gia-muted-2)' }}>
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.types.map((type) => {
                  const meta = PROTOCOL_META[type];
                  const isAuto = autoConfirmTypes.includes(type);
                  return (
                    <Switch
                      key={type}
                      checked={isAuto}
                      onChange={(enabled) => setAutoConfirm(type, enabled)}
                      label={meta.label}
                      description={isAuto ? 'Auto-approved — no prompt' : 'Requires your approval'}
                      icon={<span style={{ fontSize: 11 }}>{meta.icon}</span>}
                      accentColor={meta.color}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <div className="mt-3 p-2.5 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={11} style={{ color: 'var(--gia-muted-2)' }} />
            <span className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
              {totalCount} protocol{totalCount !== 1 ? 's' : ''} recorded
              {activeCount > 0 && ` (${activeCount} active)`}
            </span>
          </div>
          <button
            onClick={clearConsoleProtocols}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
          >
            <Trash2 size={10} /> Clear
          </button>
        </div>
      )}

      {!fullAutonomy && (
        <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)' }}>
          <p className="text-[9px] leading-relaxed" style={{ color: 'var(--gia-muted)' }}>
            Tools marked as auto-approved run without asking. All others pause and show a prompt in the Protocol Panel (⚡) until you approve or reject them. Timeout: 30 seconds.
          </p>
        </div>
      )}
    </div>
  );
};
