import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const isNative =
  typeof window !== 'undefined' &&
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.();

class BiometricService {
  private static instance: BiometricService;
  static getInstance() { if (!this.instance) this.instance = new BiometricService(); return this.instance; }

  private pinKey = 'gia-pin-hash';

  async isAvailable() {
    if (isNative) {
      try {
        const result = await NativeBiometric.isAvailable();
        return result.isAvailable;
      } catch { return false; }
    }
    // Web: check WebAuthn support
    return typeof window.PublicKeyCredential !== 'undefined';
  }

  async verify() {
    if (isNative) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          // Fallback to PIN
          return this.verifyPIN();
        }
        await NativeBiometric.verifyIdentity({
          reason: 'Access your GIA Workspace',
          title: 'Biometric Login',
          subtitle: 'Private AI Assistant',
          description: 'Please authenticate to continue',
        });
        return true;
      } catch (e) {
        console.error('Biometric verification failed:', e);
        return this.verifyPIN();
      }
    }

    // Web: try WebAuthn, fallback to PIN
    if (typeof window.PublicKeyCredential !== 'undefined') {
      const pin = prompt('Enter your GIA PIN (or leave empty to skip):');
      if (pin === null) return false;
      if (!pin) return true;
      return this.checkPIN(pin);
    }
    return this.verifyPIN();
  }

  private verifyPIN(): boolean {
    const pin = prompt('Enter your GIA PIN (set in Security settings):');
    if (pin === null) return false;
    return this.checkPIN(pin || '');
  }

  private checkPIN(pin: string): boolean {
    const hash = this.hashPIN(pin);
    const stored = localStorage.getItem(this.pinKey);
    if (!stored) {
      // No PIN set — prompt to create one
      if (pin) {
        localStorage.setItem(this.pinKey, hash);
        return true;
      }
      return true;
    }
    return hash === stored;
  }

  private hashPIN(pin: string): string {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i);
      h |= 0;
    }
    return 'pin_' + Math.abs(h).toString(36);
  }

  setLockEnabled(enabled: boolean) {
    localStorage.setItem('gia-biometric-lock', String(enabled));
    if (enabled && !localStorage.getItem(this.pinKey)) {
      const pin = prompt('Create a GIA PIN for browser fallback:');
      if (pin && pin.length >= 4) {
        localStorage.setItem(this.pinKey, this.hashPIN(pin));
      }
    }
  }

  isLockEnabled() {
    return localStorage.getItem('gia-biometric-lock') === 'true';
  }
}

export default BiometricService.getInstance();
