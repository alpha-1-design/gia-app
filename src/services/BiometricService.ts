import { NativeBiometric } from '@capgo/capacitor-native-biometric';

class BiometricService {
  private static instance: BiometricService;
  static getInstance() { if (!this.instance) this.instance = new BiometricService(); return this.instance; }

  async isAvailable() {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch { return false; }
  }

  async verify() {
    try {
      const available = await this.isAvailable();
      if (!available) return true; // Fallback if biometrics not setup on device

      await NativeBiometric.verifyIdentity({
        reason: "Access your GIA Workspace",
        title: "Biometric Login",
        subtitle: "Private AI Assistant",
        description: "Please authenticate to continue",
      });
      return true;
    } catch (e) {
      console.error('Biometric verification failed:', e);
      return false;
    }
  }

  setLockEnabled(enabled: boolean) {
    localStorage.setItem('gia-biometric-lock', String(enabled));
  }

  isLockEnabled() {
    return localStorage.getItem('gia-biometric-lock') === 'true';
  }
}

export default BiometricService.getInstance();
