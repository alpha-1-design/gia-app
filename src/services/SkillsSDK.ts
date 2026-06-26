import { logger } from '../utils/logger';

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  permissions: string[];
  hooks: SkillHook[];
  config?: Record<string, { type: string; default: unknown; description: string }>;
}

export type SkillHookType =
  | 'on_message'
  | 'on_response'
  | 'on_tool_call'
  | 'on_goal_create'
  | 'on_app_start'
  | 'on_navigate'
  | 'custom';

export interface SkillHook {
  type: SkillHookType;
  handler: string;
  priority: number;
}

export interface SkillInstance {
  definition: SkillDefinition;
  enabled: boolean;
  config: Record<string, unknown>;
  installed: number;
  updated: number;
}

type HookCallback = (context: unknown) => unknown | Promise<unknown>;

export class SkillsSDK {
  private installed: Map<string, SkillInstance> = new Map();
  private hookRegistry: Map<string, Array<{ skillId: string; priority: number; callback: HookCallback }>> = new Map();
  private onInstallCallbacks: Array<(skill: SkillInstance) => void> = [];

  onInstall(callback: (skill: SkillInstance) => void): () => void {
    this.onInstallCallbacks.push(callback);
    return () => {
      const idx = this.onInstallCallbacks.indexOf(callback);
      if (idx >= 0) this.onInstallCallbacks.splice(idx, 1);
    };
  }

  async installFromUrl(url: string): Promise<SkillInstance | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text();

      let skillDef: SkillDefinition;
      try {
        skillDef = JSON.parse(raw) as SkillDefinition;
      } catch {
        skillDef = this.parsePackageJson(raw);
      }

      return this.install(skillDef);
    } catch (e) {
      logger.warn(`[SkillsSDK] Failed to install from ${url}:`, e);
      return null;
    }
  }

  async installFromCode(code: string): Promise<SkillInstance | null> {
    try {
      const skillDef = this.parsePackageJson(code);
      return this.install(skillDef);
    } catch (e) {
      logger.warn('[SkillsSDK] Failed to install from code:', e);
      return null;
    }
  }

  private parsePackageJson(content: string): SkillDefinition {
    const parsed = JSON.parse(content);
    return {
      id: parsed.id || parsed.name || `skill-${Date.now()}`,
      name: parsed.name || 'Unnamed Skill',
      version: parsed.version || '1.0.0',
      description: parsed.description || '',
      author: parsed.author || 'Unknown',
      homepage: parsed.homepage,
      license: parsed.license,
      permissions: parsed.permissions || [],
      hooks: parsed.hooks || [],
      config: parsed.config,
    };
  }

  async install(definition: SkillDefinition): Promise<SkillInstance> {
    const existing = this.installed.get(definition.id);
    if (existing) {
      if (existing.definition.version === definition.version) {
        return existing;
      }
    }

    const instance: SkillInstance = {
      definition,
      enabled: true,
      config: {},
      installed: existing?.installed || Date.now(),
      updated: Date.now(),
    };

    this.installed.set(definition.id, instance);

    for (const hookDef of definition.hooks) {
      this.registerHook(definition.id, hookDef);
    }

    this.onInstallCallbacks.forEach((cb) => {
      try { cb(instance); } catch (e) { logger.warn('[SkillsSDK] Install callback error:', e); }
    });

    logger.info(`[SkillsSDK] Installed: ${definition.name} v${definition.version}`);
    return instance;
  }

  uninstall(skillId: string): void {
    this.installed.delete(skillId);
    for (const [hookType, handlers] of this.hookRegistry) {
      this.hookRegistry.set(
        hookType,
        handlers.filter((h) => h.skillId !== skillId)
      );
    }
    logger.info(`[SkillsSDK] Uninstalled: ${skillId}`);
  }

  toggleSkill(skillId: string, enabled: boolean): void {
    const skill = this.installed.get(skillId);
    if (skill) {
      skill.enabled = enabled;
    }
  }

  private registerHook(skillId: string, hookDef: SkillHook): void {
    const key = hookDef.type;
    if (!this.hookRegistry.has(key)) {
      this.hookRegistry.set(key, []);
    }

    this.hookRegistry.get(key)!.push({
      skillId,
      priority: hookDef.priority || 0,
      callback: () => {
        const win = window as unknown as Record<string, unknown>;
        if (typeof win[hookDef.handler] === 'function') {
          return (win[hookDef.handler] as (...args: unknown[]) => unknown)(hookDef);
        }
      },
    });

    this.hookRegistry.get(key)!.sort((a, b) => b.priority - a.priority);
  }

  async executeHooks(hookType: SkillHookType, context: unknown): Promise<unknown[]> {
    const handlers = this.hookRegistry.get(hookType);
    if (!handlers || handlers.length === 0) return [];

    const results: unknown[] = [];
    for (const handler of handlers) {
      const skill = this.installed.get(handler.skillId);
      if (!skill?.enabled) continue;

      try {
        const result = await handler.callback(context);
        if (result !== undefined) results.push(result);
      } catch (e) {
        logger.warn(`[SkillsSDK] Hook ${hookType} failed for ${handler.skillId}:`, e);
      }
    }
    return results;
  }

  getInstalledSkills(): SkillInstance[] {
    return Array.from(this.installed.values());
  }

  getSkill(id: string): SkillInstance | undefined {
    return this.installed.get(id);
  }

  getStoreListings(): Array<{ name: string; description: string; version: string; author: string }> {
    return [
      {
        name: 'Template: Auto-Responder',
        description: 'Auto-respond to specific message patterns',
        version: '1.0.0',
        author: 'GIA',
      },
      {
        name: 'Template: Daily Digest',
        description: 'Sends a daily summary of notifications and events',
        version: '1.0.0',
        author: 'GIA',
      },
      {
        name: 'Template: Focus Mode',
        description: 'Blocks distractions and helps maintain focus',
        version: '1.0.0',
        author: 'GIA',
      },
    ];
  }

  createManifest(name: string, description: string): SkillDefinition {
    return {
      id: `skill-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name,
      version: '1.0.0',
      description,
      author: 'Custom',
      permissions: [],
      hooks: [],
    };
  }

  getStats(): string {
    const skills = this.getInstalledSkills();
    return `Skills SDK: ${skills.length} installed, ${skills.filter((s) => s.enabled).length} enabled`;
  }
}

export const skillsSDK = new SkillsSDK();
