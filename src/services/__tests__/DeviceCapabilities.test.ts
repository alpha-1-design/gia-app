import { describe, it, expect } from 'vitest';
import {
  checkModelCompatibility,
  recommendModel,
  type DeviceCapabilities,
} from '../DeviceCapabilities';

const baseCaps: DeviceCapabilities = {
  totalRAMGB: 8,
  availableRAMGB: 5.5,
  availableStorageGB: 20,
  cpuCores: 8,
  hasGPU: true,
  isMobile: false,
  measured: true,
  notes: [],
};

const MODELS = [
  { id: '0.5B', ramEstimate: '~1.2 GB', downloadSize: '~1 GB', parameters: '0.5B' },
  { id: '1.5B', ramEstimate: '~3 GB', downloadSize: '~3 GB', parameters: '1.5B' },
  { id: '3B', ramEstimate: '~6 GB', downloadSize: '~6 GB', parameters: '3B' },
];

describe('checkModelCompatibility', () => {
  it('marks a small model as OK on a capable device', () => {
    const res = checkModelCompatibility(baseCaps, { ramEstimate: '~1.2 GB', downloadSize: '~1 GB' });
    expect(res.level).toBe('ok');
    expect(res.ramOk).toBe(true);
    expect(res.storageOk).toBe(true);
    expect(res.cpuOk).toBe(true);
    expect(res.warnings).toHaveLength(0);
  });

  it('flags insufficient RAM and warns about crashing', () => {
    const lowRam: DeviceCapabilities = { ...baseCaps, availableRAMGB: 1.0 };
    const res = checkModelCompatibility(lowRam, { ramEstimate: '~3 GB', downloadSize: '~3 GB' });
    expect(res.ramOk).toBe(false);
    expect(res.level).toBe('insufficient');
    expect(res.warnings.some(w => /Not enough RAM/.test(w))).toBe(true);
  });

  it('flags insufficient storage with actionable shortfall', () => {
    const lowStorage: DeviceCapabilities = { ...baseCaps, availableStorageGB: 0.5 };
    const res = checkModelCompatibility(lowStorage, { ramEstimate: '~1.2 GB', downloadSize: '~3 GB' });
    expect(res.storageOk).toBe(false);
    expect(res.level).toBe('insufficient');
    expect(res.warnings.some(w => /Free up/.test(w))).toBe(true);
  });

  it('flags weak CPU as tight (runs but slow) when RAM/storage are fine', () => {
    const weakCpu: DeviceCapabilities = { ...baseCaps, cpuCores: 2 };
    const res = checkModelCompatibility(weakCpu, { ramEstimate: '~1.2 GB', downloadSize: '~1 GB' });
    expect(res.cpuOk).toBe(false);
    expect(res.ramOk).toBe(true);
    expect(res.storageOk).toBe(true);
    expect(res.level).toBe('tight');
  });

  it('reports tight (not insufficient) when RAM is close but adequate', () => {
    const tight: DeviceCapabilities = { ...baseCaps, availableRAMGB: 3.6 };
    const res = checkModelCompatibility(tight, { ramEstimate: '~3 GB', downloadSize: '~3 GB' });
    // 3GB * 1.15 = 3.45 needed; 3.6 available → OK-ish but < 1.5x margin → tight
    expect(res.level).toBe('tight');
  });
});

describe('recommendModel', () => {
  it('recommends the largest model that fits', () => {
    const rec = recommendModel(baseCaps, MODELS);
    expect(rec).toBe('1.5B'); // 3B needs 6GB RAM, only 5.5 free
  });

  it('recommends 0.5B when RAM is very limited', () => {
    const lowRam: DeviceCapabilities = { ...baseCaps, availableRAMGB: 1.5 };
    const rec = recommendModel(lowRam, MODELS);
    expect(rec).toBe('0.5B');
  });

  it('returns null when no model fits', () => {
    const tiny: DeviceCapabilities = { ...baseCaps, availableRAMGB: 0.5, availableStorageGB: 0.3 };
    const rec = recommendModel(tiny, MODELS);
    expect(rec).toBeNull();
  });
});
