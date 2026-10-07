import rawConfig from '../../config.json';

/**
 * GIA's app-level configuration, analogous to opencode's `opencode.json`.
 * Edit config.json at the repo root to change shipped defaults; user choices
 * made in the app (stored per-device) always win over these.
 */
export interface AppConfig {
  app: { name: string };
  ui: { floatingOrbDefault: boolean; reduceMotionDefault: boolean };
  model: { defaultLocalModel: string };
}

export const appConfig: AppConfig = rawConfig as AppConfig;

/** Resolve a persisted boolean (stored value wins) or fall back to the config default. */
export function prefOrDefault(storageKey: string, fallback: boolean): boolean {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (stored !== null) return stored === 'true';
  } catch { /* storage blocked — use config default */ }
  return fallback;
}