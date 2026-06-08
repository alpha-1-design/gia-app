import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import BiometricService from '../../services/BiometricService';

export const SecuritySection: React.FC = () => {
  const [lockEnabled, setLockEnabled] = useState(() => BiometricService.isLockEnabled());
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    BiometricService.isAvailable().then(setAvailable);
  }, []);

  return (
    <div className="gia-card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="flex items-center gap-2">
        <Lock size={14} style={{ color: '#3b82f6' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gia-muted)' }}>
          Security
        </span>
      </div>

      <label className="flex items-center gap-3 tap-feedback" style={{ cursor: 'pointer', opacity: available ? 1 : 0.5 }}>
        <div
          onClick={async () => {
            if (!available) return;
            const newVal = !lockEnabled;
            if (newVal) {
              const ok = await BiometricService.verify();
              if (!ok) return;
            }
            setLockEnabled(newVal);
            BiometricService.setLockEnabled(newVal);
          }}
          className="w-8 h-4 rounded-full relative transition-all shrink-0"
          style={{ background: lockEnabled ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{ left: lockEnabled ? '18px' : '2px', background: lockEnabled ? '#3b82f6' : 'var(--gia-muted-2)' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>Biometric Lock</p>
          <p className="text-[10px]" style={{ color: 'var(--gia-muted-2)' }}>
            {available ? 'Protect GIA with FaceID/Fingerprint on startup.' : 'Biometrics not supported on this device.'}
          </p>
        </div>
      </label>
    </div>
  );
};
