/**
 * PermissionManager.ts — Plugin Permission System
 *
 * Manages granular permission grants per plugin with a tiered permission model.
 * Grants are persisted in localStorage under 'gia-plugin-permissions'.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type PermissionLevel = 'none' | 'network' | 'storage' | 'full';

export interface PermissionManifest {
  origins: string[];
  permissions: string[];
  hooks: string[];
  maxMemoryMB: number;
  maxExecutionMs: number;
  maxAPICalls: number;
}

export interface PermissionSet {
  level: PermissionLevel;
  origins: string[];
  permissions: string[];
  hooks: string[];
  maxMemoryMB: number;
  maxExecutionMs: number;
  maxAPICalls: number;
}

export interface PermissionGrant {
  pluginId: string;
  level: PermissionLevel;
  origins: string[];
  permissions: string[];
  hooks: string[];
  maxMemoryMB: number;
  maxExecutionMs: number;
  maxAPICalls: number;
  grantedAt: number;
  session: string;
}

// ── Default permissions per hook type ─────────────────────────────────────

const HOOK_DEFAULT_LEVELS: Record<string, PermissionLevel> = {
  onInit: 'none',
  onActivate: 'none',
  onDeactivate: 'none',
  onBeforeGenerate: 'network',
  onAfterGenerate: 'network',
  onToolRegister: 'storage',
};

// ── Level presets ─────────────────────────────────────────────────────────

const LEVEL_PRESETS: Record<PermissionLevel, Omit<PermissionSet, 'level'>> = {
  none: {
    origins: [],
    permissions: [],
    hooks: [],
    maxMemoryMB: 8,
    maxExecutionMs: 1000,
    maxAPICalls: 10,
  },
  network: {
    origins: ['*'],
    permissions: ['read:message'],
    hooks: ['onBeforeGenerate', 'onAfterGenerate'],
    maxMemoryMB: 16,
    maxExecutionMs: 5000,
    maxAPICalls: 50,
  },
  storage: {
    origins: ['*'],
    permissions: ['read:message', 'write:storage', 'read:storage'],
    hooks: ['onBeforeGenerate', 'onAfterGenerate', 'onToolRegister'],
    maxMemoryMB: 32,
    maxExecutionMs: 10000,
    maxAPICalls: 200,
  },
  full: {
    origins: ['*'],
    permissions: ['*'],
    hooks: ['*'],
    maxMemoryMB: 64,
    maxExecutionMs: 15000,
    maxAPICalls: 500,
  },
};

// ── Storage key ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'gia-plugin-permissions';

// ── Manager ───────────────────────────────────────────────────────────────

export class PermissionManager {
  private static instance: PermissionManager;
  private grants: Map<string, PermissionGrant> = new Map();
  private loaded = false;

  static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Request a permission grant for a plugin.
   * Determines the effective permission level based on the requested set.
   */
  requestPermission(
    pluginId: string,
    requestedPerms: Partial<PermissionManifest>,
  ): { granted: boolean; session: string } {
    this.load();

    const effectiveLevel = this.computeLevel(requestedPerms);
    const preset = LEVEL_PRESETS[effectiveLevel];

    const grant: PermissionGrant = {
      pluginId,
      level: effectiveLevel,
      origins: requestedPerms.origins ?? preset.origins,
      permissions: requestedPerms.permissions ?? preset.permissions,
      hooks: requestedPerms.hooks ?? preset.hooks,
      maxMemoryMB: requestedPerms.maxMemoryMB ?? preset.maxMemoryMB,
      maxExecutionMs: requestedPerms.maxExecutionMs ?? preset.maxExecutionMs,
      maxAPICalls: requestedPerms.maxAPICalls ?? preset.maxAPICalls,
      grantedAt: Date.now(),
      session: this.generateSessionId(),
    };

    this.grants.set(pluginId, grant);
    this.save();
    return { granted: true, session: grant.session };
  }

  /** Revoke all permissions for a plugin. */
  revokePermission(pluginId: string): void {
    this.load();
    this.grants.delete(pluginId);
    this.save();
  }

  /** Check whether a plugin holds a specific named permission. */
  hasPermission(pluginId: string, permission: string): boolean {
    this.load();
    const grant = this.grants.get(pluginId);
    if (!grant) return false;
    return grant.permissions.includes('*') || grant.permissions.includes(permission);
  }

  /** Get the full effective permission set for a plugin. */
  getEffectivePermissions(pluginId: string): PermissionSet {
    this.load();
    const grant = this.grants.get(pluginId);
    if (!grant) {
      // Default to 'none'
      return { level: 'none', ...LEVEL_PRESETS.none };
    }
    const { pluginId: _id, grantedAt: _ga, session: _s, ...rest } = grant;
    return rest;
  }

  /** Get default permission level for a given hook name. */
  getDefaultLevelForHook(hookName: string): PermissionLevel {
    return HOOK_DEFAULT_LEVELS[hookName] ?? 'none';
  }

  /** List all grants (for debugging / UI). */
  listGrants(): PermissionGrant[] {
    this.load();
    return Array.from(this.grants.values());
  }

  /** Clear all grants. */
  clearAll(): void {
    this.grants.clear();
    this.save();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private computeLevel(requested: Partial<PermissionManifest>): PermissionLevel {
    const perms = requested.permissions ?? [];

    if (perms.includes('*')) return 'full';
    if (perms.some((p) => p.startsWith('write:'))) return 'storage';
    if (perms.some((p) => p.startsWith('read:'))) return 'network';

    // Check origins
    const origins = requested.origins ?? [];
    if (origins.includes('*') || origins.length > 0) return 'network';

    return 'none';
  }

  private generateSessionId(): string {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback: Math.random (less secure but non-critical)
      return Math.random().toString(36).substring(2, 15) +
             Math.random().toString(36).substring(2, 15);
    }
  }

  private load(): void {
    if (this.loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PermissionGrant[] = JSON.parse(raw);
        for (const g of parsed) {
          this.grants.set(g.pluginId, g);
        }
      }
    } catch {
      // localStorage unavailable or corrupt — start fresh
    }
    this.loaded = true;
  }

  private save(): void {
    try {
      const data = JSON.stringify(Array.from(this.grants.values()));
      localStorage.setItem(STORAGE_KEY, data);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}

export default PermissionManager.getInstance();
