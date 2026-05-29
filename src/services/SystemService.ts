/**
 * Deep system embedding — provides real-time system context to GIA.
 * OS info, hardware, battery, network, display, locale, timezone.
 */

export interface SystemInfo {
  platform: string;
  userAgent: string;
  language: string;
  timezone: string;
  timezoneOffset: number;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  hardware: {
    cpuCores: number | null;
    memoryGB: number | null;
    touchScreen: boolean;
  };
  battery: {
    charging: boolean | null;
    level: number | null;
    dischargingTime: number | null;
  } | null;
  network: {
    online: boolean;
    type: string | null;
    downlink: number | null;
    rtt: number | null;
  };
  os: string;
  isMobile: boolean;
  isDesktop: boolean;
  isNativeApp: boolean;
  container: 'browser' | 'capacitor' | 'pwa';
}

class SystemService {
  private _batteryListener: (() => void) | null = null;
  private _networkListener: (() => void) | null = null;
  private _onChange: ((info: SystemInfo) => void) | null = null;
  private _lastInfo: SystemInfo | null = null;
  private _formattedContext = '';

  get formattedContext(): string {
    return this._formattedContext;
  }

  setChangeHandler(handler: (info: SystemInfo) => void): void {
    this._onChange = handler;
  }

  async getInfo(): Promise<SystemInfo> {
    const isCapacitor = typeof (window as any)?.Capacitor?.isNativePlatform === 'function' &&
      (window as any).Capacitor.isNativePlatform();

    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any)?.standalone === true;

    const platform = this._getPlatform();
    const info: SystemInfo = {
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: devicePixelRatio || 1,
      },
      hardware: {
        cpuCores: navigator.hardwareConcurrency || null,
        memoryGB: (navigator as any).deviceMemory || null,
        touchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      },
      battery: null,
      network: {
        online: navigator.onLine,
        type: null,
        downlink: null,
        rtt: null,
      },
      os: platform,
      isMobile: /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent),
      isDesktop: !/Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent),
      isNativeApp: isCapacitor,
      container: isCapacitor ? 'capacitor' : isStandalone ? 'pwa' : 'browser',
    };

    // Network info
    try {
      const conn = (navigator as any).connection;
      if (conn) {
        info.network.type = conn.effectiveType || null;
        info.network.downlink = conn.downlink || null;
        info.network.rtt = conn.rtt || null;
      }
    } catch {}

    // Battery info
    try {
      const battery = await (navigator as any).getBattery?.();
      if (battery) {
        info.battery = {
          charging: battery.charging,
          level: battery.level,
          dischargingTime: battery.dischargingTime === Infinity ? null : battery.dischargingTime,
        };
      }
    } catch {}

    this._lastInfo = info;
    this._formattedContext = this._buildContext(info);
    return info;
  }

  private _buildContext(info: SystemInfo): string {
    const batteryStr = info.battery
      ? `${Math.round((info.battery.level || 0) * 100)}%${info.battery.charging ? ' (charging)' : ''}`
      : 'unknown';
    const lines = [
      `- System: ${info.os} on ${info.container}`,
      `- Hardware: ${info.hardware.cpuCores || '?'} cores · ${info.hardware.memoryGB || '?'} GB RAM`,
      `- Network: ${info.network.online ? 'Online' : 'Offline'}${info.network.type ? ` (${info.network.type})` : ''}`,
      `- Battery: ${batteryStr}`,
      `- Screen: ${info.screen.width}x${info.screen.height}`,
      `- Timezone: ${info.timezone}`,
    ];
    return lines.join('\n');
  }

  async startMonitoring(): Promise<void> {
    await this.getInfo();

    // Network changes
    const updateNetwork = () => {
      if (!this._lastInfo) return;
      this._lastInfo.network.online = navigator.onLine;
      const conn = (navigator as any).connection;
      if (conn) {
        this._lastInfo.network.type = conn.effectiveType || this._lastInfo.network.type;
        this._lastInfo.network.downlink = conn.downlink || this._lastInfo.network.downlink;
      }
      this._formattedContext = this._buildContext(this._lastInfo);
      this._onChange?.({ ...this._lastInfo });
    };

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener('change', updateNetwork);
    }

    this._networkListener = () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      conn?.removeEventListener('change', updateNetwork);
    };

    // Battery changes
    try {
      const battery = await (navigator as any).getBattery?.();
      if (battery) {
        const updateBattery = () => {
          if (!this._lastInfo || !this._lastInfo.battery) return;
          this._lastInfo.battery.charging = battery.charging;
          this._lastInfo.battery.level = battery.level;
          this._onChange?.({ ...this._lastInfo });
        };
        battery.addEventListener('chargingchange', updateBattery);
        battery.addEventListener('levelchange', updateBattery);
        this._batteryListener = () => {
          battery.removeEventListener('chargingchange', updateBattery);
          battery.removeEventListener('levelchange', updateBattery);
        };
      }
    } catch {}
  }

  stopMonitoring(): void {
    this._networkListener?.();
    this._batteryListener?.();
    this._networkListener = null;
    this._batteryListener = null;
  }

  private _getPlatform(): string {
    const ua = navigator.userAgent;
    if (/Win/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    return 'Unknown';
  }

  formatInfo(info: SystemInfo): string {
    const lines = [
      `OS: ${info.os}`,
      `Platform: ${info.platform}`,
      `Container: ${info.container}`,
      `Language: ${info.language}`,
      `Timezone: ${info.timezone} (UTC${info.timezoneOffset >= 0 ? '-' : '+'}${Math.abs(info.timezoneOffset / 60)})`,
      `Screen: ${info.screen.width}x${info.screen.height} @${info.screen.pixelRatio}x`,
      `CPU: ${info.hardware.cpuCores || 'unknown'} cores`,
      `Memory: ${info.hardware.memoryGB || 'unknown'} GB`,
      `Touch: ${info.hardware.touchScreen ? 'Yes' : 'No'}`,
      `Online: ${info.network.online ? 'Yes' : 'No'}`,
      `Network: ${info.network.type || 'unknown'}`,
      `Battery: ${info.battery ? `${Math.round((info.battery.level || 0) * 100)}%${info.battery.charging ? ' (charging)' : ''}` : 'unknown'}`,
    ];
    return lines.join('\n');
  }
}

export default new SystemService();
