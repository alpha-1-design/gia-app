import { logger } from '../utils/logger';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { isNativePlatform } from '../utils/helpers';

const isNative = isNativePlatform();

class BiometricService {
  private static instance: BiometricService;
  static getInstance() { if (!this.instance) this.instance = new BiometricService(); return this.instance; }

  private pinKey = 'gia-pin-hash';

  async isAvailable() {
    if (isNative) {
      try {
        const result = await NativeBiometric.isAvailable();
        return result.isAvailable;
      } catch (e) { logger.warn('[BiometricService] Native biometric unavailable:', e); return false; }
    }
    // Web: check WebAuthn support
    return typeof window.PublicKeyCredential !== 'undefined';
  }

  async verify() {
    if (isNative) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          return await this.verifyPIN();
        }
        await NativeBiometric.verifyIdentity({
          reason: 'Access your GIA Workspace',
          title: 'Biometric Login',
          subtitle: 'Private AI Assistant',
          description: 'Please authenticate to continue',
        });
        return true;
      } catch (e) {
        logger.error('Biometric verification failed:', e);
        return await this.verifyPIN();
      }
    }

    if (typeof window.PublicKeyCredential !== 'undefined') {
      const pin = prompt('Enter your GIA PIN (or leave empty to skip):');
      if (pin === null) return false;
      if (!pin) return true;
      return await this.checkPIN(pin);
    }
    return await this.verifyPIN();
  }

  private async verifyPIN(): Promise<boolean> {
    const pin = prompt('Enter your GIA PIN (set in Security settings):');
    if (pin === null) return false;
    return this.checkPIN(pin || '');
  }

  private async checkPIN(pin: string): Promise<boolean> {
    const hash = await this.hashPIN(pin);
    const stored = localStorage.getItem(this.pinKey);
    if (!stored) {
      if (pin) {
        localStorage.setItem(this.pinKey, hash);
        return true;
      }
      return true;
    }
    return hash === stored;
  }

  private async hashPIN(pin: string): Promise<string> {
    try {
      const enc = new TextEncoder().encode(pin);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const arr = Array.from(new Uint8Array(buf));
      return 'pin_' + arr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 0;
      for (let i = 0; i < pin.length; i++) {
        h = ((h << 5) - h) + pin.charCodeAt(i);
        h |= 0;
      }
      return 'pin_' + Math.abs(h).toString(36);
    }
  }

  async setLockEnabled(enabled: boolean) {
    localStorage.setItem('gia-biometric-lock', String(enabled));
    if (enabled && !localStorage.getItem(this.pinKey)) {
      const pin = prompt('Create a GIA PIN for browser fallback:');
      if (pin && pin.length >= 4) {
        localStorage.setItem(this.pinKey, await this.hashPIN(pin));
      }
    }
  }

  isLockEnabled() {
    return localStorage.getItem('gia-biometric-lock') === 'true';
  }
}

export default BiometricService.getInstance();
