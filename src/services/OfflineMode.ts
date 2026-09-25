import { useGiaStore } from '../store/useGiaStore';

/**
 * OfflineMode — enforcement helpers for On-Device Mode.
 *
 * The toggle lives in the store (`onDeviceMode`, Settings → Reliability and
 * the composer Tools sheet). The *promise* is "nothing leaves your device";
 * this module is the shared vocabulary every enforcement point uses so the
 * guarantee is one definition, not scattered string checks:
 *
 *  1. ProviderService.callProvider  → forces routing to the on-device LLM.
 *  2. brain/toolRunner              → blocks any tool outside the allowlist.
 *  3. CloudSTT.cloudTranscribe      → refuses to send audio to the cloud.
 *
 * Tools on the allowlist run on-device by construction: memory, notes, tasks,
 * clipboard, the local sandbox filesystem, device info, and local ML helpers.
 * Prefix matching keeps the list robust as tool ids evolve.
 */

const ON_DEVICE_TOOLS = new Set([
  'list_files',
  'get_environment_info',
  'get_user_location',
  'vibrate',
]);

const ON_DEVICE_TOOL_PREFIXES = [
  'memory_',
  'note_',
  'task_',
  'clipboard',
  'filesystem_',
  'device_',
  'classify_',
  'calculator',
];

/** True when On-Device Mode is enabled. */
export function isOnDeviceMode(): boolean {
  try {
    return useGiaStore.getState().onDeviceMode;
  } catch {
    return false;
  }
}

/** True when a tool runs entirely on-device (safe under On-Device Mode). */
export function isOnDeviceTool(toolId: string): boolean {
  if (ON_DEVICE_TOOLS.has(toolId)) return true;
  return ON_DEVICE_TOOL_PREFIXES.some((p) => toolId.startsWith(p));
}
