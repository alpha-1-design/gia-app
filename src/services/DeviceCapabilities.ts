import { logger } from '../utils/logger';
import { Capacitor } from '@capacitor/core';
import { GIADeviceInfo } from './GIADeviceInfo';

// ── Types ───────────────────────────────────────────────────────────

export interface DeviceCapabilities {
  /** Total physical RAM in GB (best estimate). */
  totalRAMGB: number;
  /** Estimated available RAM in GB (total minus assumed OS/app baseline). */
  availableRAMGB: number;
  /** Free/available storage space in GB. */
  availableStorageGB: number;
  /** Number of logical CPU cores. */
  cpuCores: number;
  /** Whether a WebGL-capable GPU is present. */
  hasGPU: boolean;
  /** Whether the device reports itself as low-powered / mobile. */
  isMobile: boolean;
  /** True if RAM/storage came from a real measurement, not a guess. */
  measured: boolean;
  /** Human-readable notes about detection confidence. */
  notes: string[];
}

export type CompatLevel = 'ok' | 'tight' | 'insufficient';

export interface ModelCompatResult {
  /** Overall verdict. */
  level: CompatLevel;
  /** Reasons the model might not run / may crash. */
  warnings: string[];
  /** Whether RAM is sufficient. */
  ramOk: boolean;
  /** Whether storage has room for the download. */
  storageOk: boolean;
  /** Whether CPU is sufficient for acceptable speed. */
  cpuOk: boolean;
}

// ── Model requirement parsing ───────────────────────────────────────
// Catalog strings look like "~1.2 GB" / "~1 GB" / "~3 GB" / "~6 GB".

function parseGB(str: string): number {
  const m = str.match(/([\d.]+)\s*(GB|MB|G|M)?/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const unit = (m[2] || 'GB').toUpperCase();
  if (unit.startsWith('M')) return num / 1024;
  return num;
}

// ── Capability detection ────────────────────────────────────────────

let cachedCaps: DeviceCapabilities | null = null;

function detectGPU(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) : '';
    // Software renderers (SwiftShader / llvmpipe) are effectively no GPU.
    return !/swiftshader|llvmpipe|software/i.test(renderer);
  } catch {
    return false;
  }
}

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua) || (typeof window !== 'undefined' && window.innerWidth < 768 && /Mobi/i.test(ua));
}

const GB = 1024 ** 3;

/**
 * Best-effort device capability detection, native-first:
 *
 *  1. GIADeviceInfo Capacitor plugin — real total/available RAM, real
 *     storage, real CPU cores from Android (ActivityManager + StatFs).
 *  2. Browser APIs (navigator.deviceMemory / StorageManager) — Chrome
 *     web fallback.
 *  3. Conservative estimate from device class — never presented as real.
 *
 * Before, on a real phone the WebView usually lacked deviceMemory and the
 * code silently guessed "4 GB". Now a real Android build gets the truth.
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  if (cachedCaps) return cachedCaps;

  const notes: string[] = [];
  const isMobile = detectMobile();
  const hasGPU = detectGPU();

  // ── 1. Native (Capacitor / Android) ────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await GIADeviceInfo.getDeviceInfo();
      const totalRAM = info.totalRAM;
      const availRAM = info.availableRAM;
      const storageFree = info.storageFree || info.externalStorageFree;
      const storageTotal = info.storageTotal;

      if (totalRAM > 0) {
        const totalRAMGB = totalRAM / GB;
        // Reserve the OS + app baseline; if the native plugin gave us
        // real available RAM, prefer it directly.
        const reserve = isMobile ? 1.5 : 2.5;
        const availableRAMGB = availRAM > 0 ? Math.max(0, availRAM / GB) : Math.max(0, totalRAMGB - reserve);
        const availableStorageGB = storageFree > 0 ? storageFree / GB : 8;
        const cpuCores = info.cpuCores > 0 ? info.cpuCores : navigator.hardwareConcurrency || (isMobile ? 4 : 8);
        notes.push(`Native: ${info.manufacturer || ''} ${info.model || ''} (Android ${info.androidVersion || '?'}, API ${info.apiLevel || '?'})`);
        notes.push(`Native RAM: ${totalRAMGB.toFixed(1)} GB total, ${availableRAMGB.toFixed(1)} GB available`);
        if (info.isLowRamDevice) notes.push('Device classed as low-RAM by Android');
        if (storageFree > 0) notes.push(`Native free storage: ${availableStorageGB.toFixed(1)} GB`);

        cachedCaps = {
          totalRAMGB,
          availableRAMGB,
          availableStorageGB,
          cpuCores,
          hasGPU,
          isMobile,
          measured: true,
          notes,
        };
        return cachedCaps;
      }
      notes.push('Native plugin returned no RAM — falling back to browser APIs');
    } catch (e) {
      notes.push('Native device info unavailable — falling back to browser APIs');
      logger.warn('[deviceCaps] native detection failed', e);
    }
  }

  // ── 2. Browser APIs (Chrome web fallback) ──────────────────────
  const rawMem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  let totalRAMGB: number | null = null;
  if (typeof rawMem === 'number' && rawMem > 0) {
    totalRAMGB = rawMem;
    notes.push(`Reported device memory: ${rawMem} GB`);
  }

  let availableStorageGB = 8;
  let storageMeasured = false;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.usage !== undefined && est.quota !== undefined && est.quota > 0) {
        const freeBytes = Math.max(0, (est.quota || 0) - (est.usage || 0));
        availableStorageGB = freeBytes / GB;
        storageMeasured = true;
        notes.push(`Measured free storage: ${availableStorageGB.toFixed(1)} GB`);
      }
    }
  } catch (e) {
    notes.push('Storage estimate failed — using default');
    logger.warn('[deviceCaps] storage estimate failed', e);
  }

  if (totalRAMGB !== null) {
    const reserve = isMobile ? 1.5 : 2.5;
    cachedCaps = {
      totalRAMGB,
      availableRAMGB: Math.max(0, totalRAMGB - reserve),
      availableStorageGB,
      cpuCores: navigator.hardwareConcurrency || (isMobile ? 4 : 8),
      hasGPU,
      isMobile,
      measured: storageMeasured,
      notes,
    };
    return cachedCaps;
  }

  // ── 3. Honest estimate (never presented as measured) ───────────
  const estimatedRAM = isMobile ? 4 : 8;
  notes.push('No real RAM source available — using conservative estimate; treat compatibility as approximate');
  cachedCaps = {
    totalRAMGB: estimatedRAM,
    availableRAMGB: Math.max(0, estimatedRAM - (isMobile ? 1.5 : 2.5)),
    availableStorageGB,
    cpuCores: navigator.hardwareConcurrency || (isMobile ? 4 : 8),
    hasGPU,
    isMobile,
    measured: storageMeasured,
    notes,
  };
  return cachedCaps;
}

export function clearDeviceCapsCache(): void {
  cachedCaps = null;
}

// ── Compatibility check ─────────────────────────────────────────────

/**
 * Check whether a model with the given RAM / download requirements can
 * run on this device. Returns a verdict plus human-readable warnings.
 */
export function checkModelCompatibility(
  caps: DeviceCapabilities,
  opts: { ramEstimate: string; downloadSize: string },
): ModelCompatResult {
  const neededRAM = parseGB(opts.ramEstimate);
  const neededSpace = parseGB(opts.downloadSize);

  const warnings: string[] = [];
  let ramOk = true;
  let storageOk = true;
  let cpuOk = true;

  // ── RAM ───────────────────────────────────────────────────────
  // Models run in WASM/ONNX on CPU; they need the full estimate in RAM.
  // We also add a 15% safety margin for tokenizer + overhead.
  const ramWithMargin = neededRAM * 1.15;
  if (caps.availableRAMGB < ramWithMargin) {
    ramOk = false;
    warnings.push(
      `Not enough RAM — this model needs ~${neededRAM.toFixed(1)} GB but your device has only ~${caps.availableRAMGB.toFixed(1)} GB free. It will likely crash or be killed.`,
    );
  } else if (caps.availableRAMGB < ramWithMargin * 1.5) {
    warnings.push(
      `Tight on RAM (~${caps.availableRAMGB.toFixed(1)} GB free vs ~${neededRAM.toFixed(1)} GB needed). May run slowly or stutter.`,
    );
  }

  // ── Storage ───────────────────────────────────────────────────
  // Download includes the model weights; we want 20% headroom for cache/extraction.
  const spaceWithMargin = neededSpace * 1.2;
  if (caps.availableStorageGB < spaceWithMargin) {
    storageOk = false;
    const shortfall = (spaceWithMargin - caps.availableStorageGB).toFixed(1);
    warnings.push(
      `Not enough storage — download needs ~${neededSpace.toFixed(1)} GB but only ~${caps.availableStorageGB.toFixed(1)} GB free. Free up ${shortfall} GB first.`,
    );
  }

  // ── CPU ───────────────────────────────────────────────────────
  // Sub-4-core devices will be painfully slow and risk OOM under load.
  if (caps.cpuCores < 4) {
    cpuOk = false;
    warnings.push(
      `Only ${caps.cpuCores} CPU core(s) detected — generation will be very slow and may time out.`,
    );
  } else if (caps.cpuCores < 6) {
    warnings.push(`Limited CPU (${caps.cpuCores} cores) — expect slower responses.`);
  }

  // ── GPU note ──────────────────────────────────────────────────
  if (!caps.hasGPU) {
    warnings.push('No hardware GPU detected — running on CPU only (expected for ONNX, fine for small models).');
  }

  let level: CompatLevel = 'ok';
  if (!ramOk || !storageOk || !cpuOk) {
    level = (!ramOk || !storageOk) ? 'insufficient' : 'tight';
  } else if (warnings.length > 0) {
    level = 'tight';
  }

  return { level, warnings, ramOk, storageOk, cpuOk };
}

/** Pick the best model for the current device, or null if none fit. */
export function recommendModel(
  caps: DeviceCapabilities,
  models: { id: string; ramEstimate: string; downloadSize: string; parameters: string }[],
): string | null {
  // Prefer the largest model that fits comfortably.
  const fitting = models
    .map(m => ({ m, res: checkModelCompatibility(caps, m) }))
    .filter(x => x.res.level !== 'insufficient')
    .sort((a, b) => parseGB(b.m.ramEstimate) - parseGB(a.m.ramEstimate));
  return fitting.length ? fitting[0].m.id : null;
}
