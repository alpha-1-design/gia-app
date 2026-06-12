
/**
 * CircleToSearchService.ts
 *
 * TypeScript bridge for the native GIA Circle-to-Search Accessibility Service.
 * Provides the contract between the Capacitor web layer and the native Android
 * AccessibilityService that captures screenshots via a system gesture shortcut.
 */

// Capacitor plugin bridge types — these mirror the eventual native plugin.
// In development, calls resolve with empty / default values so the web layer
// can develop against the contract before the native side is fully wired.

interface CircleToSearchPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  startCapture(): Promise<{ path: string | null }>;
  getStatus(): Promise<{ enabled: boolean; supported: boolean }>;
}

// ---------------------------------------------------------------------------
// Lazy-loaded plugin reference — resolves to the Capacitor plugin when the
// app runs on a real device, or a web fallback stub in the browser.
// ---------------------------------------------------------------------------

let _plugin: CircleToSearchPlugin | null = null;

async function getPlugin(): Promise<CircleToSearchPlugin> {
  if (_plugin) return _plugin;

  try {
    // Dynamic import so the module can be tree-shaken on non-mobile builds.
    const { registerPlugin } = await import('@capacitor/core');
    _plugin = registerPlugin<CircleToSearchPlugin>('CircleToSearch', {
      web: () =>
        Promise.resolve({
          isAvailable: async () => ({ available: false }),
          startCapture: async () => ({ path: null }),
          getStatus: async () => ({ enabled: false, supported: false }),
        }),
    });
  } catch {
    // Capacitor not available — running in pure web / test environment.
    _plugin = {
      isAvailable: async () => ({ available: false }),
      startCapture: async () => ({ path: null }),
      getStatus: async () => ({ enabled: false, supported: false }),
    };
  }

  return _plugin!;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the accessibility service is currently running and enabled.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const plugin = await getPlugin();
    const { available } = await plugin.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Trigger a screen capture via the accessibility service.
 * Returns the absolute path to the saved image, or null on failure.
 */
export async function startCapture(): Promise<string | null> {
  try {
    const plugin = await getPlugin();
    const { path } = await plugin.startCapture();
    return path;
  } catch {
    return null;
  }
}

/**
 * Get the current status of the accessibility service.
 */
export async function getStatus(): Promise<{ enabled: boolean; supported: boolean }> {
  try {
    const plugin = await getPlugin();
    return await plugin.getStatus();
  } catch {
    return { enabled: false, supported: false };
  }
}

export type { CircleToSearchPlugin };
