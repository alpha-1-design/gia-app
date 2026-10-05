/**
 * Maps the sensitivity slider (0 = strict, 1 = eager) to the score a frame
 * must reach to count as a wake word. Must stay identical to
 * OpenWakeWordEngine.thresholdForSensitivity in the Android code.
 */
export function thresholdForSensitivity(sensitivity: number): number {
  const s = Math.max(0, Math.min(1, Number.isFinite(sensitivity) ? sensitivity : 0.7));
  return 0.95 - 0.6 * s;
}
