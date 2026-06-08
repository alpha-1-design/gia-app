import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './idb-storage';
import type { PluginSettings } from '../types/plugin';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
}

interface PluginStoreState {
  plugins: PluginInfo[];
  pluginSettings: Record<string, PluginSettings>;
  registerPlugin: (id: string, name: string, version: string, description: string) => void;
  unregisterPlugin: (id: string) => void;
  setPluginEnabled: (id: string, enabled: boolean) => void;
  setPluginConfig: (id: string, config: Record<string, unknown>) => void;
  updatePluginConfig: (id: string, config: Record<string, unknown>) => void;
}

export const usePluginStore = create<PluginStoreState>()(
  persist(
    (set) => ({
      plugins: [],
      pluginSettings: {},

      registerPlugin: (id, name, version, description) =>
        set((s) => ({
          plugins: s.plugins.some((p) => p.id === id)
            ? s.plugins
            : [...s.plugins, { id, name, version, description }],
          pluginSettings: s.pluginSettings[id]
            ? s.pluginSettings
            : { ...s.pluginSettings, [id]: { pluginId: id, enabled: false, config: {} } },
        })),

      unregisterPlugin: (id) =>
        set((s) => ({
          plugins: s.plugins.filter((p) => p.id !== id),
          pluginSettings: Object.fromEntries(
            Object.entries(s.pluginSettings).filter(([k]) => k !== id)
          ),
        })),

      setPluginEnabled: (id, enabled) =>
        set((s) => ({
          pluginSettings: {
            ...s.pluginSettings,
            [id]: { ...(s.pluginSettings[id] || { pluginId: id, config: {} }), enabled },
          },
        })),

      setPluginConfig: (id, config) =>
        set((s) => ({
          pluginSettings: {
            ...s.pluginSettings,
            [id]: { ...(s.pluginSettings[id] || { pluginId: id, enabled: false }), config },
          },
        })),

      updatePluginConfig: (id, config) =>
        set((s) => ({
          pluginSettings: {
            ...s.pluginSettings,
            [id]: {
              ...(s.pluginSettings[id] || { pluginId: id, enabled: false, config: {} }),
              config: { ...(s.pluginSettings[id]?.config || {}), ...config },
            },
          },
        })),
    }),
    {
      name: 'gia-plugin-store',
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        plugins: s.plugins,
        pluginSettings: s.pluginSettings,
      }),
    }
  )
);
