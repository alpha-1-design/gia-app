import { describe, it, expect } from 'vitest';
import { thresholdForSensitivity } from '../wakeWord';

describe('thresholdForSensitivity', () => {
  it('matches the native mapping at the default sensitivity', () => {
    // OpenWakeWordEngine.thresholdForSensitivity(0.7f) == 0.53f
    expect(thresholdForSensitivity(0.7)).toBeCloseTo(0.53, 6);
  });
  it('is stricter at low sensitivity and eager at high', () => {
    expect(thresholdForSensitivity(0)).toBeCloseTo(0.95, 6);
    expect(thresholdForSensitivity(1)).toBeCloseTo(0.35, 6);
  });
  it('clamps and tolerates bad input', () => {
    expect(thresholdForSensitivity(9)).toBeCloseTo(0.35, 6);
    expect(thresholdForSensitivity(-3)).toBeCloseTo(0.95, 6);
    expect(thresholdForSensitivity(NaN)).toBeCloseTo(0.53, 6);
  });
});
