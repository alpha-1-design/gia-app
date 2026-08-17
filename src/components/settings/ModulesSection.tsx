import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGiaStore } from '../../store/useGiaStore';
import { MODULES } from '../../config/appModules';
import { Switch } from '../ui/Switch';

// Chat and Settings are intentionally not listed here — they're excluded
// from hiding in the store itself (useGiaStore.setModuleHidden) so there's
// always a way back into the app and back into this screen.
const HIDEABLE_MODULES = MODULES.filter((m) => m.id !== 'chat' && m.id !== 'settings');

export const ModulesSection: React.FC = () => {
  const { hiddenModules, setModuleHidden } = useGiaStore(useShallow((s) => ({
    hiddenModules: s.hiddenModules,
    setModuleHidden: s.setModuleHidden,
  })));

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <p className="text-xs mb-3" style={{ color: 'var(--gia-muted)' }}>
        Hide modules you don't use from the module switcher and command palette. Chat and Settings always stay visible.
      </p>
      <div className="space-y-1">
        {HIDEABLE_MODULES.map((mod, i) => (
          <div key={mod.id} className={i > 0 ? 'pt-3 mt-3' : ''} style={i > 0 ? { borderTop: '1px solid var(--gia-border)' } : undefined}>
            <Switch
              checked={!hiddenModules.includes(mod.id)}
              onChange={(checked) => setModuleHidden(mod.id, !checked)}
              label={mod.label}
              description={hiddenModules.includes(mod.id) ? 'Hidden from switcher & command palette' : 'Visible in switcher & command palette'}
              icon={mod.icon}
              accentColor={mod.color}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
