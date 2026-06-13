import { Device } from '@capacitor/device';
import { isNativePlatform } from '../../utils/helpers';
import type { Tool } from './types';

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
        `- **Disk Free (est.):** ${info.diskFree ? `${(info.diskFree / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}`,
        `- **Disk Total (est.):** ${info.diskTotal ? `${(info.diskTotal / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}`,
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
        `- **Device ID (UUID):** ${idInfo.uuid || 'Unknown'}`,
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
        content: `## 🆔 Device Identifiers\n\n**UUID:** \`${idInfo.uuid || 'Unknown'}\`\n**Identifier:** \`${idInfo.identifier || 'Unknown'}\``,
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

export const deviceTools: Tool[] = [
  devicePluginInfo,
  devicePluginBattery,
  devicePluginId,
  devicePluginLocale,
];
