import type { Plugin, PluginAPI, PluginManifest, PluginHooks } from '../types/plugin';
import type { Tool } from './tools/types';
import GiaTools from './GiaTools';
import { useGiaStore } from '../store/useGiaStore';
import { usePluginStore } from '../store/usePluginStore';
import { logger } from '../utils/logger';
import { Sandbox } from './plugins/Sandbox';
import { PermissionManager } from './plugins/PermissionManager';

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

  /** Build a PluginAPI scoped to a specific plugin. */
  private getPluginAPI(pluginId: string): PluginAPI {
    return {
      ...this.createAPI(),
      // Future: add plugin-scoped overrides here
    };
  }

  /**
   * Execute a hook function through the Sandbox worker.
   * Converts the function to source, runs it in the isolated worker,
   * and returns the result. Falls back to direct call if sandbox
   * is unavailable or the hook is a no-permission-required hook.
   */
  private async executeHookInSandbox<T>(
    hookFn: Function | undefined,
    pluginId: string,
    hookName: string,
    payload?: any,
    timeoutMs?: number,
  ): Promise<T | undefined> {
    if (!hookFn) return undefined;

    const effTimeout = timeoutMs ?? 5000;
    const permManager = PermissionManager.getInstance();

    // Ensure the plugin has at least the default permission for this hook
    const defaultLevel = permManager.getDefaultLevelForHook(hookName);
    if (!permManager.hasPermission(pluginId, `hook:${hookName}`)) {
      permManager.requestPermission(pluginId, {
        hooks: [hookName],
        permissions: [`hook:${hookName}`],
        maxExecutionMs: effTimeout,
      });
    }

    const sandbox = Sandbox.getInstance();
    const logs: string[] = [];

    // Convert the function to source code and run in the sandbox
    const code = hookFn.toString();
    const result = await sandbox.execute(
      code,
      {
        pluginApi: this.getPluginAPI(pluginId),
        payload,
        console: {
          log: (...args: any[]) => logs.push(`[LOG] ${args.join(' ')}`),
          warn: (...args: any[]) => logs.push(`[WARN] ${args.join(' ')}`),
          error: (...args: any[]) => logs.push(`[ERROR] ${args.join(' ')}`),
        },
      },
      effTimeout,
    );

    // Surface collected logs
    for (const l of result.logs ?? logs) {
      logger.debug(`[PluginManager] [${pluginId}/${hookName}] ${l}`);
    }

    if (result.error) {
      throw new Error(`Plugin hook "${hookName}" error: ${result.error}`);
    }

    return result.result as T | undefined;
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
        await this.executeHookInSandbox(plugin.hooks.onActivate, id, 'onActivate');
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
        await this.executeHookInSandbox(plugin.hooks.onDeactivate, id, 'onDeactivate');
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
          const hookResult = await this.executeHookInSandbox<string>(
            plugin.hooks.onBeforeGenerate,
            plugin.manifest.id,
            'onBeforeGenerate',
            result,
          );
          if (hookResult !== undefined) result = hookResult;
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
          const hookResult = await this.executeHookInSandbox<{ text: string; provider: string; model: string }>(
            plugin.hooks.onAfterGenerate,
            plugin.manifest.id,
            'onAfterGenerate',
            result,
          );
          if (hookResult !== undefined) result = hookResult;
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
