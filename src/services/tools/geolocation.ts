import { z } from 'zod';
import { Geolocation } from '@capacitor/geolocation';
import { isNativePlatform } from '../../utils/helpers';
import type { Tool } from './types';

function formatZodError(issues: z.ZodIssue[]): string {
  return issues.map(i => {
    const path = i.path.length > 0 ? `"${i.path.join('.')}"` : 'value';
    if (i.code === 'invalid_type') {
      const info = i as unknown as { expected: string; received: string };
      return `${path}: expected ${info.expected}, got ${info.received === 'undefined' ? 'nothing' : info.received}`;
    }
    if (i.code === 'too_small' && 'minimum' in i) {
      const min = (i as { minimum: number }).minimum;
      return `${path}: must be at least ${min} character${min === 1 ? '' : 's'}`;
    }
    return i.message;
  }).join('; ');
}

const geolocationGetCurrentPosition: Tool = {
  id: 'geolocation_get_current_position',
  name: 'geolocation_get_current_position',
  description: 'Get the device\'s current GPS position. Returns latitude, longitude, accuracy, altitude, speed, and heading if available.',
  schema: {
    type: 'object',
    properties: {
      enableHighAccuracy: { type: 'boolean', description: 'Use GPS for highest accuracy (default true). Set false for faster but less accurate results.' },
      timeout: { type: 'number', description: 'Maximum time in milliseconds to wait for a position (default: 15000)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      enableHighAccuracy: z.boolean().default(true),
      timeout: z.number().min(1000).max(60000).default(15000),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Geolocation requires the GIA mobile app (Android).' };
    }
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: parsed.data.enableHighAccuracy,
        timeout: parsed.data.timeout,
      });

      const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
      const lines = [
        `**📍 Current Position**`,
        `**Latitude:** ${latitude.toFixed(6)}`,
        `**Longitude:** ${longitude.toFixed(6)}`,
      ];
      if (accuracy !== null && accuracy !== undefined) {
        lines.push(`**Accuracy:** ±${accuracy.toFixed(0)}m`);
      }
      if (altitude !== null && altitude !== undefined) {
        lines.push(`**Altitude:** ${altitude.toFixed(1)}m`);
      }
      if (speed !== null && speed !== undefined && speed >= 0) {
        lines.push(`**Speed:** ${(speed * 3.6).toFixed(1)} km/h`);
      }
      if (heading !== null && heading !== undefined && heading >= 0) {
        lines.push(`**Heading:** ${heading.toFixed(0)}°`);
      }

      return {
        success: true,
        content: lines.join('\n'),
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const geolocationWatchPosition: Tool = {
  id: 'geolocation_watch_position',
  name: 'geolocation_watch_position',
  description: 'Start watching the device position for changes. Returns the current position and a watch ID to stop watching with geolocation_clear_watch.',
  schema: {
    type: 'object',
    properties: {
      enableHighAccuracy: { type: 'boolean', description: 'Use GPS for highest accuracy (default true)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      enableHighAccuracy: z.boolean().default(true),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Geolocation requires the GIA mobile app (Android).' };
    }
    try {
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: parsed.data.enableHighAccuracy },
        () => {
          // Callback handled internally; we just need the initial position
        },
      );

      // Get an initial fix
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: parsed.data.enableHighAccuracy,
      });

      const { latitude, longitude, accuracy } = position.coords;
      return {
        success: true,
        content: `## 📡 Position Watch Started\n\n**Watch ID:** ${String(watchId)}\n\n**Current Position:**\n- **Latitude:** ${latitude.toFixed(6)}\n- **Longitude:** ${longitude.toFixed(6)}\n- **Accuracy:** ±${accuracy ? accuracy.toFixed(0) : '?'}m\n\n_Use \`geolocation_clear_watch\` with the watch ID to stop._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const geolocationClearWatch: Tool = {
  id: 'geolocation_clear_watch',
  name: 'geolocation_clear_watch',
  description: 'Stop a previously started position watch using its watch ID.',
  schema: {
    type: 'object',
    properties: {
      watchId: { type: 'string', description: 'Watch ID returned from geolocation_watch_position' },
    },
    required: ['watchId'],
  },
  execute: async (args) => {
    const schema = z.object({
      watchId: z.string().min(1, 'Watch ID is required'),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) return { success: false, content: '', error: formatZodError(parsed.error.issues) };

    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Geolocation requires the GIA mobile app (Android).' };
    }
    try {
      await Geolocation.clearWatch({ id: parsed.data.watchId });
      return {
        success: true,
        content: `## 📡 Watch Cleared\n\nWatch ID \`${parsed.data.watchId}\` has been stopped.`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const geolocationCheckPermissions: Tool = {
  id: 'geolocation_check_permissions',
  name: 'geolocation_check_permissions',
  description: 'Check whether location permissions have been granted. Returns the current permission state.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Geolocation requires the GIA mobile app (Android).' };
    }
    try {
      const result = await Geolocation.checkPermissions();
      const state = result.location === 'granted' ? '✅ Granted' : `❌ ${result.location || 'denied'}`;
      const coarseState = result.coarseLocation === 'granted' ? '✅ Granted' : `❌ ${result.coarseLocation || 'denied'}`;
      return {
        success: true,
        content: `## 📡 Location Permissions\n\n**Fine Location:** ${state}\n**Coarse Location:** ${coarseState}\n\n_Use \`geolocation_request_permissions\` if not granted._`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const geolocationRequestPermissions: Tool = {
  id: 'geolocation_request_permissions',
  name: 'geolocation_request_permissions',
  description: 'Request location permissions from the user. Call this if location access was denied previously.',
  execute: async () => {
    if (!isNativePlatform()) {
      return { success: false, content: '', error: 'Geolocation requires the GIA mobile app (Android).' };
    }
    try {
      const result = await Geolocation.requestPermissions();
      const state = result.location === 'granted' ? '✅ Granted' : `❌ ${result.location || 'denied'}`;
      return {
        success: true,
        content: `## 📡 Permission Request Result\n\n**Location Permission:** ${state}`,
      };
    } catch (e: unknown) {
      return { success: false, content: '', error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export const geolocationTools: Tool[] = [
  geolocationGetCurrentPosition,
  geolocationWatchPosition,
  geolocationClearWatch,
  geolocationCheckPermissions,
  geolocationRequestPermissions,
];
