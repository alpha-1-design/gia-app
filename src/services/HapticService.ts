import { useGiaStore } from '../store/useGiaStore';
import { isNativePlatform } from '../utils/helpers';
import { logger } from '../utils/logger';

export class HapticService {
  private static instance: HapticService;

  static getInstance(): HapticService {
    if (!this.instance) {
      this.instance = new HapticService();
    }
    return this.instance;
  }

  private isEnabled(): boolean {
    try {
      return useGiaStore.getState().hapticFeedback;
    } catch {
      return true; // Default to true if store is not initialized yet
    }
  }

  /**
   * Triggers a fast, precise physical haptic tap of specified style.
   * Useful for button clicks, switches, keyboard inputs, etc.
   */
  async impact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      if (isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        const styleMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: styleMap[style] });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        // Precise web vibration patterns (ms) mimicking native physics
        const patternMap = {
          light: 12,
          medium: 24,
          heavy: 48,
        };
        navigator.vibrate(patternMap[style]);
      }
    } catch (e) {
      logger.warn('[HapticService] Impact failed:', e);
    }
  }

  /**
   * Triggers a specific notification haptic pattern (success, warning, error).
   * Great for process status, task completions, form validation.
   */
  async notification(type: 'success' | 'warning' | 'error'): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      if (isNativePlatform()) {
        const { Haptics, NotificationType } = await import('@capacitor/haptics');
        const typeMap = {
          success: NotificationType.Success,
          warning: NotificationType.Warning,
          error: NotificationType.Error,
        };
        await Haptics.notification({ type: typeMap[type] });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        // High fidelity web vibration sequences mimicking haptic motors
        const patternMap = {
          success: [35, 40, 35],
          warning: [70, 60, 70],
          error: [90, 45, 90, 45, 140],
        };
        navigator.vibrate(patternMap[type]);
      }
    } catch (e) {
      logger.warn('[HapticService] Notification failed:', e);
    }
  }

  /**
   * Triggers a subtle tick feedback during selection changes (e.g. wheel scroll, sliders).
   */
  async selection(): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      if (isNativePlatform()) {
        const { Haptics } = await import('@capacitor/haptics');
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch (e) {
      logger.warn('[HapticService] Selection failed:', e);
    }
  }

  /**
   * Triggers a continuous hardware vibration for a specified duration in milliseconds.
   */
  async vibrate(duration: number = 200): Promise<void> {
    if (!this.isEnabled()) return;

    const clamped = Math.min(Math.max(duration, 10), 3000);

    try {
      if (isNativePlatform()) {
        const { Haptics } = await import('@capacitor/haptics');
        await Haptics.vibrate({ duration: clamped });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(clamped);
      }
    } catch (e) {
      logger.warn('[HapticService] Vibrate failed:', e);
    }
  }
}

export default HapticService.getInstance();
