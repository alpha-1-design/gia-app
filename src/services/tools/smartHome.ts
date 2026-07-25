import { z } from 'zod';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

const smartDiscover: Tool = {
  id: 'smart_discover',
  name: 'smart_discover',
  description: 'Discover smart home devices and smart TVs on the local network. Scans for UPnP/SSDP and mDNS/Bonjour devices including TVs (Samsung, LG, Android), lights (Philips Hue, Yeelight), thermostats, speakers, and smart plugs.',
  schema: {
    type: 'object',
    properties: {
      timeout: { type: 'number', description: 'Discovery timeout in ms (default 3000, max 15000)' },
      filter_type: { type: 'string', enum: ['tv', 'light', 'thermostat', 'speaker', 'switch', 'sensor'], description: 'Filter results by device type' },
      filter_brand: { type: 'string', description: 'Filter results by brand (e.g. Samsung, LG, Philips)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      timeout: z.number().min(500).max(15000).optional().default(3000),
      filter_type: z.enum(['tv', 'light', 'thermostat', 'speaker', 'switch', 'sensor']).optional(),
      filter_brand: z.string().max(50).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    try {
      const sh = (await import('../SmartHomeService')).default;
      const devices = await sh.discoverDevices(parsed.data.timeout);
      let filtered = devices;
      if (parsed.data.filter_type) {
        filtered = filtered.filter(d => d.type === parsed.data.filter_type);
      }
      if (parsed.data.filter_brand) {
        const brand = parsed.data.filter_brand.toLowerCase();
        filtered = filtered.filter(d => d.brand?.toLowerCase() === brand);
      }
      if (filtered.length === 0) {
        return {
          success: true,
          content: `## 🔍 Smart Home Discovery\n\nNo devices found${parsed.data.filter_type ? ` of type "${parsed.data.filter_type}"` : ''}${parsed.data.filter_brand ? ` from "${parsed.data.filter_brand}"` : ''}.\n\n**Tips:**\n- Ensure devices are powered on and on the same network\n- Try a longer timeout (up to 15s)\n- Some routers block multicast discovery — check your router settings`,
        };
      }
      const typeEmoji: Record<string, string> = {
        tv: '📺', light: '💡', thermostat: '🌡️', speaker: '🔊', switch: '🔌', sensor: '📡', unknown: '❓',
      };
      const lines = filtered.map((d, i) => {
        const online = d.online ? '🟢 Online' : '🔴 Offline';
        const caps = d.capabilities.length > 0 ? `\n  **Capabilities:** ${d.capabilities.join(', ')}` : '';
        const brand = d.brand ? ` **${d.brand}**` : '';
        return `${i + 1}. ${typeEmoji[d.type] || '📱'} **${d.name}**${brand}\n   **Type:** ${d.type} | **Protocol:** ${d.protocol} | **IP:** \`${d.ip}:${d.port}\` | ${online}\n   **ID:** \`${d.id}\`${caps}`;
      });
      return {
        success: true,
        content: `## 🔍 Smart Home Discovery\n\n**Found ${filtered.length} device${filtered.length !== 1 ? 's' : ''}**${parsed.data.filter_type ? ` (filtered: ${parsed.data.filter_type})` : ''}${parsed.data.filter_brand ? ` (filtered: ${parsed.data.filter_brand})` : ''}\n\n${lines.join('\n\n')}\n\n*Use the device ID with other smart_* tools to control or cast to a device.*`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const smartCast: Tool = {
  id: 'smart_cast',
  name: 'smart_cast',
  description: 'Cast a media URL to a smart TV for playback. Supports Samsung Tizen, LG webOS, Android TV, and generic DLNA/UPnP TVs. Media URLs can be video streams, YouTube links, or any playable media.',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Media URL to cast (video stream, YouTube link, or other playable media)' },
      deviceId: { type: 'string', description: 'Device ID from smart_discover' },
      title: { type: 'string', description: 'Optional title for the media' },
    },
    required: ['url', 'deviceId'],
  },
  execute: async (args) => {
    const schema = z.object({
      url: z.string().url('Must be a valid URL').min(1).max(5000),
      deviceId: z.string().min(1).max(200),
      title: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    try {
      const sh = (await import('../SmartHomeService')).default;
      const result = await sh.castToTV(parsed.data.url, parsed.data.deviceId, { title: parsed.data.title });
      if (result.success) {
        return {
          success: true,
          content: `## 📺 Media Cast\n\n**URL:** [${parsed.data.url}](${parsed.data.url})\n${parsed.data.title ? `**Title:** ${parsed.data.title}\n` : ''}**Method:** \`${result.method || 'auto'}\`\n**Status:** ✅ ${result.message}`,
        };
      }
      return { success: false, content: '', error: result.message };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const smartControl: Tool = {
  id: 'smart_control',
  name: 'smart_control',
  description: 'Send a control command to a smart home device or TV. Supports power, volume, input, navigation, playback, brightness, color, temperature, and mode commands depending on device type.',
  schema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'Device ID from smart_discover' },
      command: {
        type: 'string',
        description: 'Command to send. Common commands: power_on, power_off, volume_up, volume_down, set_volume, mute, unmute, toggle_mute, set_input, launch_app. TV remote: home, back, up, down, left, right, select, play, pause, stop, rewind, fast_forward. Lights: set_brightness, set_color. Thermostat: set_temperature, set_mode.',
      },
      level: { type: 'number', description: 'Value for set_volume (0-100) or set_brightness (0-100)' },
      volume: { type: 'number', description: 'Alias for level — volume level 0-100' },
      brightness: { type: 'number', description: 'Alias for level — brightness 0-100' },
      temperature: { type: 'number', description: 'Temperature value for thermostat set_temperature' },
      input: { type: 'string', description: 'Input source for set_input (e.g. HDMI1, HDMI2, TV, AV)' },
      source: { type: 'string', description: 'Alias for input' },
      appId: { type: 'string', description: 'App ID or name for launch_app (e.g. Netflix, YouTube, Plex)' },
      app: { type: 'string', description: 'Alias for appId' },
      mode: { type: 'string', description: 'Mode for thermostat/device set_mode (cool, heat, auto, fan, dry)' },
      color: { type: 'string', description: 'Color for lights set_color (hex code or name)' },
    },
    required: ['deviceId', 'command'],
  },
  execute: async (args) => {
    const schema = z.object({
      deviceId: z.string().min(1).max(200),
      command: z.string().min(1).max(50),
      level: z.number().min(0).max(100).optional(),
      volume: z.number().min(0).max(100).optional(),
      brightness: z.number().min(0).max(100).optional(),
      temperature: z.number().min(0).max(100).optional(),
      input: z.string().max(50).optional(),
      source: z.string().max(50).optional(),
      appId: z.string().max(100).optional(),
      app: z.string().max(100).optional(),
      mode: z.string().max(50).optional(),
      color: z.string().max(50).optional(),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    try {
      const sh = (await import('../SmartHomeService')).default;
      const params: Record<string, unknown> = {};
      if (parsed.data.level !== undefined) params.level = parsed.data.level;
      if (parsed.data.volume !== undefined) params.volume = parsed.data.volume;
      if (parsed.data.brightness !== undefined) params.brightness = parsed.data.brightness;
      if (parsed.data.temperature !== undefined) params.temperature = parsed.data.temperature;
      if (parsed.data.input) params.input = parsed.data.input;
      if (parsed.data.source) params.source = parsed.data.source;
      if (parsed.data.appId) params.appId = parsed.data.appId;
      if (parsed.data.app) params.app = parsed.data.app;
      if (parsed.data.mode) params.mode = parsed.data.mode;
      if (parsed.data.color) params.color = parsed.data.color;
      const result = await sh.sendCommand(parsed.data.deviceId, parsed.data.command, params);
      if (result.success) {
        const dataStr = result.data ? `\n**Response:** \`${JSON.stringify(result.data)}\`` : '';
        return {
          success: true,
          content: `## 🎛️ Device Command\n\n**Command:** \`${parsed.data.command}\`\n**Status:** ✅ ${result.status}${dataStr}`,
        };
      }
      return { success: false, content: '', error: result.status };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const smartStatus: Tool = {
  id: 'smart_status',
  name: 'smart_status',
  description: 'Get the current status of a smart home device or TV. Returns power state, volume, input source, media state, and other device-specific information.',
  schema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'Device ID from smart_discover' },
    },
    required: ['deviceId'],
  },
  execute: async (args) => {
    const schema = z.object({
      deviceId: z.string().min(1).max(200),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    try {
      const sh = (await import('../SmartHomeService')).default;
      const device = await sh.getDevice(parsed.data.deviceId);
      if (!device) {
        return { success: false, content: '', error: `Device "${parsed.data.deviceId}" not found. Run smart_discover first.` };
      }
      const online = device.online ? '🟢 Online' : '🔴 Offline';
      const typeEmoji: Record<string, string> = { tv: '📺', light: '💡', thermostat: '🌡️', speaker: '🔊', switch: '🔌', sensor: '📡', unknown: '❓' };
      let statusLine = `## ${typeEmoji[device.type] || '📱'} ${device.name}\n\n**ID:** \`${device.id}\`\n**Type:** ${device.type}${device.brand ? ` | **Brand:** ${device.brand}` : ''}\n**IP:** \`${device.ip}:${device.port}\`\n**Protocol:** ${device.protocol}\n**Status:** ${online}\n**Capabilities:** ${device.capabilities.join(', ') || 'None'}`;
      if (device.type === 'tv') {
        const tvStatus = await sh.getTVStatus(parsed.data.deviceId);
        if (tvStatus) {
          const power = tvStatus.power ? '🟢 On' : '🔴 Off';
          const volBar = '█'.repeat(Math.round(tvStatus.volume / 10)) + '░'.repeat(10 - Math.round(tvStatus.volume / 10));
          statusLine += `\n\n**TV Status:**\n- **Power:** ${power}\n- **Volume:** ${tvStatus.volume} \`${volBar}\`\n- **Muted:** ${tvStatus.muted ? 'Yes 🔇' : 'No 🔊'}`;
          if (tvStatus.input) statusLine += `\n- **Input:** ${tvStatus.input}`;
          if (tvStatus.app) statusLine += `\n- **App:** ${tvStatus.app}`;
          if (tvStatus.mediaState) statusLine += `\n- **Media:** ${tvStatus.mediaState}`;
        }
      }
      if (device.metadata && Object.keys(device.metadata).length > 0) {
        const metaLines = Object.entries(device.metadata).map(([k, v]) => `  **${k}:** ${v}`).join('\n');
        statusLine += `\n\n**Metadata:**\n${metaLines}`;
      }
      return { success: true, content: statusLine };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const smartHomeTools: Tool[] = [smartDiscover, smartCast, smartControl, smartStatus];


export function registerSmartHomeTools() {
  for (const tool of smartHomeTools) ToolRegistry.register(tool);
}
