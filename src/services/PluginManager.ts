import type { Plugin, PluginAPI, PluginManifest, PluginHooks } from '../types/plugin';
import type { Tool } from './tools/types';
import GiaTools from './GiaTools';
import { useGiaStore } from '../store/useGiaStore';
import { usePluginStore } from '../store/usePluginStore';
import { logger } from '../utils/logger';

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, Plugin> = new Map();
  private initialized = false;

  static getInstance(): PluginManager {
    if (!this.instance) this.instance = new PluginManager();
    return this.instance;
  }

  private createAPI(): PluginAPI {
    return {
      registerTool: (tool: Tool) => GiaTools.registerTool(tool),
      unregisterTool: (id: string) => GiaTools.unregisterTool(id),
      getTool: (id: string) => GiaTools.getTool(id),
      getAllTools: () => GiaTools.getAllTools(),
      addNotification: (msg: string) => useGiaStore.getState().addNotification(msg),
      getStore: () => useGiaStore.getState(),
    };
  }

  async register(manifest: PluginManifest, hooks: PluginHooks, setup?: (api: PluginAPI) => void | Promise<void>): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      logger.warn(`[PluginManager] Plugin ${manifest.id} already registered`);
      return;
    }

    const api = this.createAPI();
    const plugin: Plugin = {
      manifest,
      enabled: false,
      hooks,
      setup,
    };

    this.plugins.set(manifest.id, plugin);

    if (setup) {
      try {
        await setup(api);
      } catch (e) {
        logger.error(`[PluginManager] Setup failed for ${manifest.id}:`, e);
      }
    }

    const store = usePluginStore.getState();
    store.registerPlugin(manifest.id, manifest.name, manifest.version, manifest.description);

    // Auto-activate if previously enabled
    const settings = store.pluginSettings[manifest.id];
    if (settings?.enabled) {
      await this.activate(manifest.id);
    }

    logger.info(`[PluginManager] Registered plugin: ${manifest.name} v${manifest.version}`);
  }

  async unregister(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    if (plugin.enabled) {
      await this.deactivate(id);
    }

    this.plugins.delete(id);
    usePluginStore.getState().unregisterPlugin(id);
    logger.info(`[PluginManager] Unregistered plugin: ${id}`);
  }

  async activate(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin || plugin.enabled) return;

    try {
      if (plugin.hooks.onActivate) {
        await plugin.hooks.onActivate();
      }
      plugin.enabled = true;
      usePluginStore.getState().setPluginEnabled(id, true);
      logger.info(`[PluginManager] Activated plugin: ${plugin.manifest.name}`);
    } catch (e) {
      logger.error(`[PluginManager] Failed to activate ${id}:`, e);
    }
  }

  async deactivate(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin || !plugin.enabled) return;

    try {
      if (plugin.hooks.onDeactivate) {
        await plugin.hooks.onDeactivate();
      }
      plugin.enabled = false;
      usePluginStore.getState().setPluginEnabled(id, false);
      logger.info(`[PluginManager] Deactivated plugin: ${plugin.manifest.name}`);
    } catch (e) {
      logger.error(`[PluginManager] Failed to deactivate ${id}:`, e);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Activate any previously enabled plugins
    const store = usePluginStore.getState();
    for (const [id, settings] of Object.entries(store.pluginSettings)) {
      if (settings.enabled && this.plugins.has(id)) {
        await this.activate(id);
      }
    }
    logger.info(`[PluginManager] Initialized with ${this.plugins.size} registered plugins`);
  }

  async runBeforeGenerate(prompt: string): Promise<string> {
    let result = prompt;
    for (const [, plugin] of this.plugins) {
      if (plugin.enabled && plugin.hooks.onBeforeGenerate) {
        try {
          result = await plugin.hooks.onBeforeGenerate(result);
        } catch (e) {
          logger.error(`[PluginManager] onBeforeGenerate error in ${plugin.manifest.id}:`, e);
        }
      }
    }
    return result;
  }

  async runAfterGenerate(response: { text: string; provider: string; model: string }): Promise<{ text: string; provider: string; model: string }> {
    let result = response;
    for (const [, plugin] of this.plugins) {
      if (plugin.enabled && plugin.hooks.onAfterGenerate) {
        try {
          result = await plugin.hooks.onAfterGenerate(result);
        } catch (e) {
          logger.error(`[PluginManager] onAfterGenerate error in ${plugin.manifest.id}:`, e);
        }
      }
    }
    return result;
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return this.getAllPlugins().filter((p) => p.enabled);
  }

  isPluginEnabled(id: string): boolean {
    return this.plugins.get(id)?.enabled ?? false;
  }
}

export default PluginManager.getInstance();
