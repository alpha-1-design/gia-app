import type { Tool } from '../services/tools/types';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  license?: string;
}

export interface PluginHooks {
  onInit?: () => void | Promise<void>;
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
  onBeforeGenerate?: (prompt: string) => string | Promise<string>;
  onAfterGenerate?: (response: { text: string; provider: string; model: string }) => { text: string; provider: string; model: string } | Promise<{ text: string; provider: string; model: string }>;
  onToolRegister?: (tools: Map<string, Tool>) => void | Promise<void>;
}

export interface PluginAPI {
  registerTool: (tool: Tool) => void;
  unregisterTool: (id: string) => void;
  getTool: (id: string) => Tool | undefined;
  getAllTools: () => Tool[];
  addNotification: (msg: string) => void;
  getStore: () => import('../store/useGiaStore').GiaState;
}

export interface Plugin {
  manifest: PluginManifest;
  enabled: boolean;
  hooks: PluginHooks;
  setup?: (api: PluginAPI) => void | Promise<void>;
}

export interface PluginSettings {
  pluginId: string;
  enabled: boolean;
  config: Record<string, unknown>;
}
