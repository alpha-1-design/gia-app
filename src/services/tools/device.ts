import { Device } from '@capacitor/device';
import { isNativePlatform } from '../../utils/helpers';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

// Capacitor DeviceInfo may carry extra fields at runtime
interface DeviceInfoExtended {
  diskFree?: number;
  diskTotal?: number;
  uuid?: string;
  [key: string]: unknown;
}

const devicePluginInfo: Tool = {
  id: 'device_plugin_info',
  name: 'device_plugin_info',
  description: 'Get comprehensive device information using the Capacitor Device plugin: operating system, model, manufacturer, battery status, language, timezone, network info, and display metrics.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Device info requires the GIA mobile app (Android).' };
    }
    try {
      const [info, batteryInfo, languageCode, languageTag, idInfo] = await Promise.all([
        Device.getInfo(),
        Device.getBatteryInfo(),
        Device.getLanguageCode(),
        Device.getLanguageTag(),
        Device.getId(),
      ]);

      const lines = [
        '## 📱 Device Information',
        '',
        '**System**',
        `- **Platform:** ${info.platform}`,
        `- **Operating System:** ${info.operatingSystem} ${info.osVersion || ''}`,
        `- **Model:** ${info.model || 'Unknown'}`,
        `- **Manufacturer:** ${info.manufacturer || 'Unknown'}`,
        `- **Web View Version:** ${info.webViewVersion || 'Unknown'}`,
        '',
        '**Hardware**',
        `- **Is Virtual:** ${info.isVirtual ? 'Yes' : 'No'}`,
        `- **Mem Used (est.):** ${info.memUsed ? `${(info.memUsed / 1024 / 1024).toFixed(0)} MB` : 'Unknown'}`,
        `- **Disk Free (est.):** ${(() => { const infoAny = info as unknown as Record<string, unknown>; const v = infoAny.diskFree; return typeof v === 'number' ? `${(v / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'; })()}`,
        `- **Disk Total (est.):** ${(() => { const infoAny = info as unknown as Record<string, unknown>; const v = infoAny.diskTotal; return typeof v === 'number' ? `${(v / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'; })()}`,
        '',
        '**Power**',
        `- **Battery Level:** ${batteryInfo.batteryLevel !== null && batteryInfo.batteryLevel !== undefined ? `${Math.round(batteryInfo.batteryLevel * 100)}%` : 'Unknown'}`,
        `- **Charging:** ${batteryInfo.isCharging !== null && batteryInfo.isCharging !== undefined ? (batteryInfo.isCharging ? 'Yes' : 'No') : 'Unknown'}`,
        '',
        '**Locale**',
        `- **Language Code:** ${languageCode.value || 'Unknown'}`,
        `- **Language Tag:** ${languageTag.value || 'Unknown'}`,
        '',
        '**Identity**',
        `- **Device ID (UUID):** ${(idInfo as unknown as DeviceInfoExtended).uuid || 'Unknown'}`,
        `- **Device ID (Identifier):** ${idInfo.identifier || 'Unknown'}`,
      ];

      return {
        success: true,
        content: lines.join('\n'),
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const devicePluginBattery: Tool = {
  id: 'device_plugin_battery',
  name: 'device_plugin_battery',
  description: 'Get device battery information: current battery level (percentage) and charging status.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Device info requires the GIA mobile app (Android).' };
    }
    try {
      const batteryInfo = await Device.getBatteryInfo();
      const level = batteryInfo.batteryLevel !== null && batteryInfo.batteryLevel !== undefined
        ? `${Math.round(batteryInfo.batteryLevel * 100)}%`
        : 'Unknown';
      const charging = batteryInfo.isCharging !== null && batteryInfo.isCharging !== undefined
        ? (batteryInfo.isCharging ? 'Yes ⚡' : 'No')
        : 'Unknown';

      return {
        success: true,
        content: `## 🔋 Battery Information\n\n**Level:** ${level}\n**Charging:** ${charging}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const devicePluginId: Tool = {
  id: 'device_plugin_id',
  name: 'device_plugin_id',
  description: 'Get the device unique identifiers: UUID (vendor-unique) and identifier (app-scoped).',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Device info requires the GIA mobile app (Android).' };
    }
    try {
      const idInfo = await Device.getId();
      return {
        success: true,
        content: `## 🆔 Device Identifiers\n\n**UUID:** \`${(idInfo as unknown as DeviceInfoExtended).uuid || 'Unknown'}\`\n**Identifier:** \`${idInfo.identifier || 'Unknown'}\``,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const devicePluginLocale: Tool = {
  id: 'device_plugin_locale',
  name: 'device_plugin_locale',
  description: 'Get the device language and locale settings.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Device info requires the GIA mobile app (Android).' };
    }
    try {
      const [languageCode, languageTag] = await Promise.all([
        Device.getLanguageCode(),
        Device.getLanguageTag(),
      ]);
      return {
        success: true,
        content: `## 🌐 Device Locale\n\n**Language Code:** ${languageCode.value || 'Unknown'}\n**Language Tag:** ${languageTag.value || 'Unknown'}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const deviceHealth: Tool = {
  id: 'device_health',
  name: 'device_health',
  description: 'Check device health: storage usage, battery level, memory pressure. GIA can call this proactively to monitor the device and alert the user about risks.',
  execute: async () => {
    try {
      const issues: string[] = [];
      const healthy: string[] = [];

      const [info, batteryInfo] = await Promise.all([
        Device.getInfo(),
        Device.getBatteryInfo(),
      ]);

      const infoAny = info as unknown as Record<string, unknown>;

      const diskFree = typeof infoAny.diskFree === 'number' ? infoAny.diskFree : null;
      const diskTotal = typeof infoAny.diskTotal === 'number' ? infoAny.diskTotal : null;
      const memUsed = typeof infoAny.memUsed === 'number' ? infoAny.memUsed : null;

      if (diskFree !== null && diskTotal !== null && diskTotal > 0) {
        const freeGB = diskFree / 1024 / 1024 / 1024;
        const totalGB = diskTotal / 1024 / 1024 / 1024;
        const usedPct = ((totalGB - freeGB) / totalGB) * 100;
        if (usedPct > 90) {
          issues.push(`STORAGE CRITICAL: ${usedPct.toFixed(0)}% full — only ${freeGB.toFixed(1)} GB free of ${totalGB.toFixed(1)} GB`);
        } else if (usedPct > 75) {
          issues.push(`Storage warning: ${usedPct.toFixed(0)}% full (${freeGB.toFixed(1)} GB free)`);
        } else {
          healthy.push(`Storage: ${usedPct.toFixed(0)}% used, ${freeGB.toFixed(1)} GB free`);
        }
      }

      if (batteryInfo.batteryLevel !== null && batteryInfo.batteryLevel !== undefined) {
        const pct = Math.round(batteryInfo.batteryLevel * 100);
        if (pct < 15) {
          issues.push(`BATTERY CRITICAL: ${pct}% — connect charger soon`);
        } else if (pct < 30) {
          issues.push(`Battery low: ${pct}% — consider charging`);
        } else {
          healthy.push(`Battery: ${pct}%${batteryInfo.isCharging ? ' (charging)' : ''}`);
        }
      }

      if (memUsed !== null) {
        const memGB = memUsed / 1024 / 1024 / 1024;
        healthy.push(`Memory in use: ${memGB.toFixed(1)} GB`);
      }

      const platform = info.platform || 'unknown';

      let content = '## Device Health Report\n\n';
      if (issues.length > 0) {
        content += '### Issues Found\n';
        content += issues.map(i => `- ⚠️ ${i}`).join('\n');
        content += '\n\n### Healthy\n';
        content += healthy.map(i => `- ✅ ${i}`).join('\n');
        content += `\n\n**Platform:** ${platform}`;
      } else {
        content += 'Everything looks good!\n';
        content += healthy.map(i => `- ✅ ${i}`).join('\n');
        content += `\n\n**Platform:** ${platform}`;
      }

      return { success: true, content };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const deviceTools: Tool[] = [
  devicePluginInfo,
  devicePluginBattery,
  devicePluginId,
  devicePluginLocale,
  deviceHealth,
];


export function registerDeviceTools() {
  for (const tool of deviceTools) ToolRegistry.register(tool);
}
