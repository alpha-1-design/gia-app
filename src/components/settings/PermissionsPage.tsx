import React from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import { SubPageHeader } from './SubPageHeader';
import {
  usePermissionStore,
  PERMISSION_METADATA,
  openSystemSettings,
  type PermissionId,
} from '../../services/PermissionService';

/**
 * PermissionsPage — Settings → Permissions.
 *
 * Every protected capability GIA can use, with a three-state toggle
 * (Ask / Always allow / Deny), the plain-language reason GIA asks for it,
 * and the tools that depend on it. Special grants (overlay, exact alarms,
 * DND, battery, installs) deep-link into the matching Android settings
 * screen since those are OS-level switches, not runtime prompts.
 */

const SETTINGS_ONLY: PermissionId[] = ['overlay', 'exactAlarm', 'notificationsPolicy', 'batteryExemption', 'installPackages'];

const ORDER: PermissionId[] = [
  'camera', 'microphone', 'location', 'contacts', 'sms', 'notifications',
  'storage', 'overlay', 'exactAlarm', 'notificationsPolicy',
  'batteryExemption', 'installPackages',
];

const GRANT_LABEL: Record<'granted' | 'denied' | 'ask', string> = {
  granted: 'Allowed',
  denied: 'Denied',
  ask: 'Ask every time',
};

const GRANT_COLOR: Record<'granted' | 'denied' | 'ask', string> = {
  granted: '#34d399',
  denied: '#f87171',
  ask: '#fbbf24',
};

export const PermissionsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const grants = usePermissionStore(s => s.grants);
  const setGrant = usePermissionStore(s => s.setGrant);

  const cycleGrant = (id: PermissionId) => {
    const order: Array<'ask' | 'granted' | 'denied'> = ['ask', 'granted', 'denied'];
    const next = order[(order.indexOf(grants[id]) + 1) % order.length];
    setGrant(id, next);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--gia-bg)', padding: '20px 16px', gap: '12px' }}>
      <SubPageHeader title="Permissions" onBack={onBack} />

      <div className="px-3 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', color: 'var(--gia-muted)' }}>
        <p className="font-semibold mb-1.5" style={{ color: '#34d399' }}>What GIA may access</p>
        <p>
          GIA only asks for a permission the moment a task actually needs it — never upfront, never in bulk.
          Tap a permission to cycle <strong>Ask every time → Allowed → Denied</strong>. When a tool needs a denied
          permission, GIA tells you what it couldn't do and why instead of failing silently.
        </p>
      </div>

      {ORDER.map((id) => {
        const meta = PERMISSION_METADATA[id];
        const state = grants[id];
        const settingsOnly = SETTINGS_ONLY.includes(id);
        return (
          <div
            key={id}
            className="rounded-xl px-3.5 py-3"
            style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Shield size={13} style={{ color: GRANT_COLOR[state] }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--gia-text)' }}>{meta.label}</span>
                </div>
                <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--gia-muted)' }}>{meta.description}</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--gia-muted-2)' }}>Used by: {meta.tools.join(', ')}</p>
              </div>
              <button
                onClick={() => (settingsOnly ? void openSystemSettings(id) : cycleGrant(id))}
                className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 tap-feedback"
                style={{
                  background: 'var(--gia-surface-2, #27272a)',
                  border: `1px solid ${GRANT_COLOR[state]}55`,
                  color: GRANT_COLOR[state],
                }}
              >
                {settingsOnly ? 'System' : GRANT_LABEL[state]}
                <ChevronRight size={10} />
              </button>
            </div>
          </div>
        );
      })}

      <p className="text-[10px] leading-relaxed px-1 pb-2" style={{ color: 'var(--gia-muted-2)' }}>
        Overlay, alarms, DND, battery and install permissions are managed by Android itself — the button opens the
        matching system screen. Everything else is controlled right here, and GIA checks it before every tool call.
      </p>
    </div>
  );
};

export default PermissionsPage;
