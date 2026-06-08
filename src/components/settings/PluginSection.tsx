import React from 'react';
import { Puzzle, Power, PowerOff } from 'lucide-react';
import { usePluginStore } from '../../store/usePluginStore';
import PluginManager from '../../services/PluginManager';

export const PluginSection: React.FC = () => {
  const { plugins, pluginSettings } = usePluginStore();

  const handleToggle = async (pluginId: string, currentEnabled: boolean) => {
    if (currentEnabled) {
      await PluginManager.deactivate(pluginId);
    } else {
      await PluginManager.activate(pluginId);
    }
  };

  if (plugins.length === 0) {
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Puzzle size={16} style={{ color: '#a855f7' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Plugins</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--gia-muted)' }}>
          No plugins installed. Plugins extend GIA with new capabilities using the Plugin API.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--gia-surface)', border: '1px solid var(--gia-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Puzzle size={16} style={{ color: '#a855f7' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--gia-text)' }}>Plugins ({plugins.length})</span>
      </div>
      <div className="space-y-2">
        {plugins.map((plugin) => {
          const settings = pluginSettings[plugin.id];
          const enabled = settings?.enabled ?? false;
          return (
            <div
              key={plugin.id}
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{
                background: enabled ? 'rgba(168,85,247,0.06)' : 'transparent',
                border: `1px solid ${enabled ? 'rgba(168,85,247,0.15)' : 'var(--gia-border)'}`,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--gia-text)' }}>{plugin.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--gia-muted-2)' }}>v{plugin.version}</span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--gia-muted)' }}>{plugin.description}</p>
              </div>
              <button
                onClick={() => handleToggle(plugin.id, enabled)}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg transition-all tap-feedback"
                style={{
                  background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                  color: enabled ? '#34d399' : '#f87171',
                }}
              >
                {enabled ? <Power size={11} /> : <PowerOff size={11} />}
                {enabled ? 'Active' : 'Inactive'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
