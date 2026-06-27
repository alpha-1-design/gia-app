import { Device } from '@capacitor/device';
import GiaTools from './GiaTools';
import { useGiaStore } from '../store/useGiaStore';
import { useProviderStore } from '../store/useProviderStore';
import { isNativePlatform } from '../utils/helpers';

export interface DiagnosticReport {
  system: {
    batteryLevel: number;
    batteryCharging: boolean;
    storageFree: string;
    storageTotal: string;
    networkStatus: 'online' | 'offline';
    platform: string;
  };
  security: {
    scanStatus: 'not_run' | 'clean' | 'issues_found' | 'unavailable';
    threatsFound: number;
    message: string;
  };
  provider: {
    connected: boolean;
    name: string;
    model: string;
    latencyMs: number | null;
  };
  capabilities: {
    webSearch: boolean;
    filesystem: boolean;
    terminal: boolean;
    codeExecution: boolean;
    voiceInput: boolean;
    screenCapture: boolean;
    musicPlayback: boolean;
    mediaLibrary: boolean;
    smartHome: boolean;
    pdfGeneration: boolean;
  };
  tools: {
    total: number;
  };
}

async function safeToolCall(id: string, args: Record<string, unknown> = {}): Promise<{ success: boolean; content: string }> {
  try {
    const tool = GiaTools.getTool(id);
    if (!tool) return { success: false, content: '' };
    const result = await tool.execute(args);
    return result;
  } catch {
    return { success: false, content: '' };
  }
}

export class SystemDiagnostics {
  static async runDiagnostics(): Promise<DiagnosticReport> {
    const isNative = isNativePlatform();
    const giaStore = useGiaStore.getState();
    const providerStore = useProviderStore.getState();

    // Battery
    let batteryLevel = 0;
    let batteryCharging = false;
    try {
      if (isNative) {
        const batteryInfo = await Device.getBatteryInfo();
        batteryLevel = batteryInfo.batteryLevel ?? 0;
        batteryCharging = batteryInfo.isCharging ?? false;
      }
    } catch {
      const batResult = await safeToolCall('device_plugin_battery');
      if (batResult.success) {
        const levelMatch = batResult.content.match(/(\d+)%/);
        batteryLevel = levelMatch ? parseInt(levelMatch[1]) / 100 : 0;
        batteryCharging = batResult.content.includes('⚡');
      }
    }

    // Storage
    let storageFree = 'Unknown';
    let storageTotal = 'Unknown';
    try {
      if (isNative) {
        const info = await Device.getInfo();
        const infoAny = info as unknown as Record<string, unknown>;
        if (typeof infoAny.diskFree === 'number') {
          storageFree = `${(infoAny.diskFree / 1024 / 1024 / 1024).toFixed(1)} GB`;
        }
        if (typeof infoAny.diskTotal === 'number') {
          storageTotal = `${(infoAny.diskTotal / 1024 / 1024 / 1024).toFixed(1)} GB`;
        }
      }
    } catch {
      const infoResult = await safeToolCall('device_plugin_info');
      if (infoResult.success) {
        const freeMatch = infoResult.content.match(/Disk Free.*?([\d.]+)\s*GB/);
        const totalMatch = infoResult.content.match(/Disk Total.*?([\d.]+)\s*GB/);
        if (freeMatch) storageFree = `${freeMatch[1]} GB`;
        if (totalMatch) storageTotal = `${totalMatch[1]} GB`;
      }
    }

    // Provider
    const activeProviderName = providerStore.activeProvider;
    const providerConfig = providerStore.providers[activeProviderName];
    const connected = !!(providerConfig?.enabled && providerConfig?.apiKey);

    let latencyMs: number | null = null;
    if (connected && providerConfig?.baseUrl) {
      try {
        const start = performance.now();
        const baseUrl = providerConfig.baseUrl.replace(/\/+$/, '');
        await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        latencyMs = Math.round(performance.now() - start);
      } catch {
        latencyMs = null;
      }
    }

    // Capabilities
    const native = isNative;
    const capabilities = {
      webSearch: true,
      filesystem: native,
      terminal: true,
      codeExecution: true,
      voiceInput: native || (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)),
      screenCapture: native,
      musicPlayback: native,
      mediaLibrary: native,
      smartHome: true,
      pdfGeneration: true,
    };

    if (native) {
      const mediaResult = await safeToolCall('media_access', { action: 'status' });
      if (mediaResult.success) {
        capabilities.musicPlayback = true;
      }
    }

    return {
      system: {
        batteryLevel: Math.round(batteryLevel * 100),
        batteryCharging,
        storageFree,
        storageTotal,
        networkStatus: giaStore.connectionStatus,
        platform: native ? 'android' : 'web',
      },
      security: {
        scanStatus: 'not_run',
        threatsFound: 0,
        message: 'Security scan not performed during initial diagnostics.',
      },
      provider: {
        connected,
        name: activeProviderName,
        model: providerConfig?.model || 'unknown',
        latencyMs,
      },
      capabilities,
      tools: {
        total: GiaTools.getAllTools().length,
      },
    };
  }
}
