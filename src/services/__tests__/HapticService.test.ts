import { describe, it, expect, vi, beforeEach } from 'vitest';
import HapticService from '../HapticService';

// Mock helpers
vi.mock('../../utils/helpers', () => ({
  isNativePlatform: vi.fn(() => false),
}));

// Mock store
vi.mock('../../store/useGiaStore', () => {
  return {
    useGiaStore: {
      getState: () => ({ hapticFeedback: true }),
    },
  };
});

// Mock capacitor haptics
const mockImpact = vi.fn();
const mockNotification = vi.fn();
const mockVibrate = vi.fn();
const mockSelectionStart = vi.fn();
const mockSelectionChanged = vi.fn();
const mockSelectionEnd = vi.fn();

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: (args: unknown) => mockImpact(args),
    notification: (args: unknown) => mockNotification(args),
    vibrate: (args: unknown) => mockVibrate(args),
    selectionStart: () => mockSelectionStart(),
    selectionChanged: () => mockSelectionChanged(),
    selectionEnd: () => mockSelectionEnd(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}));

describe('HapticService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup navigator.vibrate
    if (typeof globalThis.navigator === 'undefined') {
      (globalThis as unknown as Record<string, unknown>).navigator = {} as unknown as Navigator;
    }
    (globalThis.navigator as unknown as Record<string, unknown>).vibrate = vi.fn();
  });

  it('vibrates on impact when on web platform', async () => {
    const { isNativePlatform } = await import('../../utils/helpers');
    vi.mocked(isNativePlatform).mockReturnValue(false);

    await HapticService.impact('light');
    expect(navigator.vibrate).toHaveBeenCalledWith(12);

    await HapticService.impact('medium');
    expect(navigator.vibrate).toHaveBeenCalledWith(24);

    await HapticService.impact('heavy');
    expect(navigator.vibrate).toHaveBeenCalledWith(48);
  });

  it('triggers Capacitor haptics on native platform', async () => {
    const { isNativePlatform } = await import('../../utils/helpers');
    vi.mocked(isNativePlatform).mockReturnValue(true);

    await HapticService.impact('light');
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });

    await HapticService.impact('heavy');
    expect(mockImpact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });

  it('supports notification haptics', async () => {
    const { isNativePlatform } = await import('../../utils/helpers');
    vi.mocked(isNativePlatform).mockReturnValue(false);

    await HapticService.notification('success');
    expect(navigator.vibrate).toHaveBeenCalledWith([35, 40, 35]);
  });
});
