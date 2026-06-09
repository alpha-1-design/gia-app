import { logger } from '../utils/logger';
import type { SystemInfo } from './SystemService';

interface Contact {
  id: string;
  name: string;
  phones: { number: string; label: string }[];
  emails: { address: string; label: string }[];
  photo?: string;
}

interface DeviceInfoResult {
  platform: string;
  os: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  batteryLevel: number | null;
  isCharging: boolean | null;
  networkOnline: boolean;
  networkType: string | null;
  language: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  cpuCores: number | null;
  memoryGB: number | null;
  container: string;
}

class DeviceIntegration {
  private static instance: DeviceIntegration;

  static getInstance(): DeviceIntegration {
    if (!this.instance) this.instance = new DeviceIntegration();
    return this.instance;
  }

  private isCapacitor(): boolean {
    try {
      const w = window as { Capacitor?: { isNativePlatform?: () => boolean } };
      return typeof w.Capacitor?.isNativePlatform === 'function' &&
        w.Capacitor.isNativePlatform();
    } catch { return false; }
  }

  async sendWhatsApp(phone: string, message: string): Promise<{ method: string }> {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const text = encodeURIComponent(message);

    try {
      if (this.isCapacitor()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          text: message,
          title: 'Share via WhatsApp',
          dialogTitle: 'Share with',
          url: `https://wa.me/${cleaned}?text=${text}`,
        });
        return { method: 'capacitor_share' };
      }
    } catch (e) {
      logger.warn('[DeviceIntegration] Capacitor share failed, falling back to wa.me:', e);
    }

    window.open(`https://wa.me/${cleaned}?text=${text}`, '_blank');
    return { method: 'wa.me_link' };
  }

  async sendEmail(to: string, subject: string, body: string): Promise<{ method: string }> {
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    return { method: 'mailto_link' };
  }

  async sendSMS(phone: string, message: string): Promise<{ method: string }> {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const text = encodeURIComponent(message);

    try {
      if (this.isCapacitor()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ text: message, title: 'Send SMS', dialogTitle: 'Send via' });
        return { method: 'capacitor_share' };
      }
    } catch { /* ignore */ }

    window.location.href = `sms:${cleaned}${cleaned ? `?body=${text}` : ''}`;
    return { method: 'sms_link' };
  }

  async makeCall(phone: string): Promise<{ method: string }> {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{5,15}$/.test(cleaned)) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
    window.location.href = `tel:${cleaned}`;
    return { method: 'tel_link' };
  }

  async shareContent(title: string, text: string, url?: string): Promise<{ method: string }> {
    try {
      if (this.isCapacitor()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title,
          text,
          url: url || undefined,
          dialogTitle: 'Share via',
        });
        return { method: 'capacitor_share' };
      }
    } catch { /* ignore */ }

    if (navigator.share) {
      await navigator.share({ title, text, url });
      return { method: 'web_share_api' };
    }

    if (navigator.clipboard?.writeText) {
      const shareText = url ? `${title}\n${text}\n${url}` : `${title}\n${text}`;
      await navigator.clipboard.writeText(shareText);
      return { method: 'clipboard_fallback' };
    }

    throw new Error('No sharing method available on this device');
  }

  async clipboardRead(): Promise<string> {
    try {
      if (this.isCapacitor()) {
        const { Clipboard } = await import('@capacitor/clipboard');
        const result = await Clipboard.read();
        return result.value ?? '';
      }
    } catch { /* ignore */ }

    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }

    throw new Error('Clipboard reading not available');
  }

  async clipboardWrite(text: string): Promise<void> {
    try {
      if (this.isCapacitor()) {
        const { Clipboard } = await import('@capacitor/clipboard');
        await Clipboard.write({ string: text });
        return;
      }
    } catch { /* ignore */ }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    throw new Error('Clipboard writing not available');
  }

  async vibrate(durationMs: number): Promise<{ method: string }> {
    try {
      if (this.isCapacitor()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        if (durationMs < 500) {
          await Haptics.impact({ style: ImpactStyle.Light });
        } else if (durationMs < 1000) {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } else {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        }
        return { method: 'capacitor_haptics' };
      }
    } catch { /* ignore */ }

    if (navigator.vibrate) {
      navigator.vibrate(Math.min(durationMs, 5000));
      return { method: 'vibration_api' };
    }

    throw new Error('Vibration not available on this device');
  }

  async getBrightness(): Promise<number> {
    try {
      if (this.isCapacitor()) {
        const { ScreenBrightness } = await import('@capacitor-community/screen-brightness');
        const result = await ScreenBrightness.getBrightness();
        return result.brightness;
      }
    } catch { /* ignore */ }

    throw new Error('Screen brightness reading not available on web');
  }

  async setBrightness(value: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, value));
    try {
      if (this.isCapacitor()) {
        const { ScreenBrightness } = await import('@capacitor-community/screen-brightness');
        await ScreenBrightness.setBrightness({ brightness: clamped });
        return;
      }
    } catch { /* ignore */ }

    throw new Error('Screen brightness control not available on web');
  }

  async getDeviceInfo(): Promise<DeviceInfoResult> {
    let platform = '';
    let os = '';
    let osVersion = '';
    let model = '';
    let manufacturer = '';

    try {
      if (this.isCapacitor()) {
        const { Device } = await import('@capacitor/device');
        const [info] = await Promise.all([
          Device.getInfo(),
        ]);
        platform = info.platform;
        os = info.operatingSystem;
        osVersion = info.osVersion || '';
        model = info.model || '';
        manufacturer = info.manufacturer || '';
      }
    } catch { /* ignore */ }

    const sysInfo = await this.getSystemInfo();

    return {
      platform: platform || sysInfo.platform,
      os: os || sysInfo.os,
      osVersion,
      model,
      manufacturer,
      batteryLevel: sysInfo.battery?.level ?? null,
      isCharging: sysInfo.battery?.charging ?? null,
      networkOnline: sysInfo.network.online,
      networkType: sysInfo.network.type,
      language: sysInfo.language,
      timezone: sysInfo.timezone,
      screenWidth: sysInfo.screen.width,
      screenHeight: sysInfo.screen.height,
      cpuCores: sysInfo.hardware.cpuCores,
      memoryGB: sysInfo.hardware.memoryGB,
      container: sysInfo.container,
    };
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const { default: systemService } = await import('./SystemService');
    return await systemService.getInfo();
  }

  async getContacts(query?: string): Promise<Contact[]> {
    try {
      if (this.isCapacitor()) {
        const { Contacts } = await import('@capacitor-community/contacts');
        const permission = await Contacts.requestPermissions();
        if (permission?.contacts !== 'granted') {
          throw new Error('Contacts permission denied');
        }
        const result = await Contacts.getContacts({
          projection: {
            name: true,
            phones: true,
            emails: true,
            thumbnail: true,
          },
        });
        const contacts = (result.contacts || []).map((c: { contactId?: string; displayName?: string; phones?: { number?: string | null; label?: string | null }[]; emails?: { address?: string | null; label?: string | null }[]; thumbnail?: string }) => ({
          id: c.contactId || '',
          name: c.displayName || 'Unknown',
          phones: (c.phones || []).map(p => ({ number: p.number ?? '', label: p.label ?? '' })),
          emails: (c.emails || []).map(e => ({ address: e.address ?? '', label: e.label ?? '' })),
          photo: c.thumbnail,
        }));
        if (query) {
          const q = query.toLowerCase();
          return contacts.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.phones.some(p => p.number.includes(q)) ||
            c.emails.some(e => e.address.toLowerCase().includes(q))
          ).slice(0, 50);
        }
        return contacts.slice(0, 100);
      }
    } catch (e) {
      logger.warn('[DeviceIntegration] Contacts failed:', e);
      throw e;
    }

    throw new Error('Contacts access requires native Android/iOS app');
  }

  async openUrl(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  formatDeviceInfo(info: DeviceInfoResult): string {
    const lines = [
      `**Device Info**`,
      `- Platform: ${info.platform} ${info.os} ${info.osVersion}`,
      ``,
      `**Hardware**`,
      `- Model: ${info.model || 'Unknown'}`,
      `- Manufacturer: ${info.manufacturer || 'Unknown'}`,
      `- CPU Cores: ${info.cpuCores || 'Unknown'}`,
      `- Memory: ${info.memoryGB || 'Unknown'} GB`,
      `- Screen: ${info.screenWidth}x${info.screenHeight}`,
      ``,
      `**Power**`,
      `- Battery: ${info.batteryLevel !== null ? `${Math.round(info.batteryLevel * 100)}%` : 'Unknown'}`,
      `- Charging: ${info.isCharging !== null ? (info.isCharging ? 'Yes' : 'No') : 'Unknown'}`,
      ``,
      `**Connectivity**`,
      `- Online: ${info.networkOnline ? 'Yes' : 'No'}`,
      `- Network: ${info.networkType || 'Unknown'}`,
      ``,
      `**System**`,
      `- Language: ${info.language}`,
      `- Timezone: ${info.timezone}`,
      `- Container: ${info.container}`,
    ];
    return lines.join('\n');
  }
}

export default DeviceIntegration.getInstance();
