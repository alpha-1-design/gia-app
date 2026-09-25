import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, X } from 'lucide-react';
import {
  usePermissionStore,
  PERMISSION_METADATA,
  openSystemSettings,
  type PermissionId,
} from '../services/PermissionService';

/**
 * PermissionPopup — the single in-app dialog for permission grants.
 *
 * Rendered once (in App.tsx) and driven entirely by the store's `pending`
 * request. When a tool needs a permission the user hasn't granted, GIA's
 * generation loop pauses at the gate in brain/toolRunner until the user
 * decides here, then continues automatically.
 */
export const PermissionPopup: React.FC = () => {
  const pending = usePermissionStore(s => s.pending);
  const resolvePending = usePermissionStore(s => s.resolvePending);

  // Keep hook order stable — nothing below runs hooks conditionally.
  const meta = pending ? PERMISSION_METADATA[pending.permission] : null;

  const handleGrant = React.useCallback(() => {
    if (!pending) return;
    resolvePending(true, false);
  }, [pending, resolvePending]);

  const handleAlwaysAllow = React.useCallback(() => {
    if (!pending) return;
    resolvePending(true, true);
  }, [pending, resolvePending]);

  const handleDeny = React.useCallback(() => {
    if (!pending) return;
    resolvePending(false, false);
  }, [pending, resolvePending]);

  const handleNeverAsk = React.useCallback(() => {
    if (!pending) return;
    resolvePending(false, true);
  }, [pending, resolvePending]);

  const handleOpenSettings = React.useCallback(() => {
    if (!pending) return;
    void openSystemSettings(pending.permission);
  }, [pending]);

  // Settings-worthy permissions where the OS prompt may already be
  // permanently denied — offer the deep link directly.
  const needsSettingsLink: PermissionId[] = ['overlay', 'exactAlarm', 'notificationsPolicy', 'batteryExemption', 'installPackages'];
  const showSettings = pending ? needsSettingsLink.includes(pending.permission) : false;

  return (
    <AnimatePresence>
      {pending && meta && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-popup-title"
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-6"
            style={{
              background: 'var(--gia-surface, #18181b)',
              border: '1px solid var(--gia-border, #27272a)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
            initial={{ y: 80, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <Shield size={17} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <h2 id="permission-popup-title" className="text-sm font-semibold" style={{ color: 'var(--gia-text, #f4f4f5)' }}>
                    {meta.label} needed
                  </h2>
                  <p className="text-[11px]" style={{ color: 'var(--gia-muted-2, #a1a1aa)' }}>for {pending.toolName}</p>
                </div>
              </div>
              <button onClick={handleDeny} aria-label="Dismiss" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--gia-muted, #71717a)' }}>
                <X size={14} />
              </button>
            </div>

            <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--gia-text, #f4f4f5)' }}>
              GIA needs <strong>{meta.label}</strong> to do this.
            </p>
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'var(--gia-muted, #a1a1aa)' }}>
              {meta.description}
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleGrant}
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all tap-feedback active:scale-[0.98]"
                style={{ background: '#34d399', color: '#052e16' }}
              >
                Allow once
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleAlwaysAllow}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback active:scale-[0.98]"
                  style={{ background: 'var(--gia-surface-2, #27272a)', color: 'var(--gia-text, #f4f4f5)', border: '1px solid var(--gia-border, #3f3f46)' }}
                >
                  Always allow
                </button>
                <button
                  onClick={handleNeverAsk}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all tap-feedback active:scale-[0.98]"
                  style={{ background: 'var(--gia-surface-2, #27272a)', color: 'var(--gia-muted, #a1a1aa)', border: '1px solid var(--gia-border, #3f3f46)' }}
                >
                  Deny
                </button>
              </div>
              {showSettings && (
                <button
                  onClick={handleOpenSettings}
                  className="w-full py-2 text-[11px] font-medium underline-offset-2 hover:underline"
                  style={{ color: 'var(--gia-muted-2, #a1a1aa)' }}
                >
                  Open system settings instead
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionPopup;
