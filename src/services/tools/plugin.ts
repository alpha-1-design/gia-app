import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const pluginTools: Tool[] = [
  {
    id: 'plugin_list',
    name: 'plugin_list',
    description: 'List all installed plugins and their enabled/disabled status.',
    execute: async () => {
      try {
        const { usePluginStore } = await import('../../store/usePluginStore');
        const { plugins, pluginSettings } = usePluginStore.getState();
        if (plugins.length === 0) {
          return { success: true, content: 'No plugins installed.' };
        }
        const lines = plugins.map(p => {
          const setting = pluginSettings[p.id];
          const enabled = setting?.enabled ?? false;
          return `- **${p.name}** (${p.id}) v${p.version} — ${enabled ? 'enabled' : 'disabled'}`;
        });
        return { success: true, content: `## Plugins\n\n${lines.join('\n')}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'plugin_install',
    name: 'plugin_install',
    description: 'Install a plugin from a URL or local manifest JSON string.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch plugin manifest from' },
        manifest: { type: 'string', description: 'JSON manifest string for local install' },
      },
    },
    execute: async (args) => {
      const url = args.url as string | undefined;
      const manifest = args.manifest as string | undefined;
      try {
        if (url) {
          const res = await fetch(url);
          if (!res.ok) return { success: false, content: '', error: `Failed to fetch plugin manifest from ${url} (HTTP ${res.status}).` };
          const manifestData = await res.json() as { name?: string; id?: string; version?: string; description?: string };
          const { usePluginStore } = await import('../../store/usePluginStore');
          usePluginStore.getState().registerPlugin(
            manifestData.id || url,
            manifestData.name || manifestData.id || 'Unknown',
            manifestData.version || '1.0.0',
            manifestData.description || ''
          );
          return { success: true, content: `Plugin "${manifestData.name || manifestData.id}" installed from ${url}.` };
        }
        if (manifest) {
          const parsed = JSON.parse(manifest) as { name?: string; id?: string; version?: string; description?: string };
          const { usePluginStore } = await import('../../store/usePluginStore');
          usePluginStore.getState().registerPlugin(
            parsed.id || `plugin-${Date.now()}`,
            parsed.name || parsed.id || 'Unknown',
            parsed.version || '1.0.0',
            parsed.description || ''
          );
          return { success: true, content: `Plugin "${parsed.name || parsed.id}" installed from manifest.` };
        }
        return { success: false, content: '', error: 'Provide a "url" or "manifest" JSON string.' };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'plugin_toggle',
    name: 'plugin_toggle',
    description: 'Enable or disable a plugin by its ID.',
    schema: {
      type: 'object',
      properties: {
        pluginId: { type: 'string', description: 'The plugin ID' },
        enabled: { type: 'boolean', description: 'Whether to enable or disable' },
      },
      required: ['pluginId', 'enabled'],
    },
    execute: async (args) => {
      const pluginId = args.pluginId as string;
      const enabled = args.enabled as boolean;
      if (!pluginId || typeof enabled !== 'boolean') {
        return { success: false, content: '', error: 'Provide "pluginId" and "enabled" (boolean).' };
      }
      try {
        const { usePluginStore } = await import('../../store/usePluginStore');
        usePluginStore.getState().setPluginEnabled(pluginId, enabled);
        return { success: true, content: `Plugin "${pluginId}" ${enabled ? 'enabled' : 'disabled'}.` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
  {
    id: 'plugin_remove',
    name: 'plugin_remove',
    description: 'Remove an installed plugin by its ID.',
    schema: {
      type: 'object',
      properties: { pluginId: { type: 'string', description: 'The plugin ID to remove' } },
      required: ['pluginId'],
    },
    execute: async (args) => {
      const pluginId = args.pluginId as string;
      try {
        const { usePluginStore } = await import('../../store/usePluginStore');
        usePluginStore.getState().unregisterPlugin(pluginId);
        return { success: true, content: `Plugin "${pluginId}" removed.` };
      } catch (e: unknown) {
        return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
      }
    }
  },
];

export function registerPluginTools() {
  for (const tool of pluginTools) ToolRegistry.register(tool);
}
