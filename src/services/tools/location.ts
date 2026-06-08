import { logger } from '../../utils/logger';
import type { Tool } from './types';
export const locationTools: Tool[] = [
  {
    id: 'get_user_location', name: 'get_user_location',
    description: 'Get the user\'s current GPS location (latitude, longitude, accuracy).',
    execute: async () => {
      try {
        const MapService = (await import('../MapService')).default;
        const pos = await MapService.getCurrentPosition();
        let address = '';
        try {
          const rev = await MapService.reverseGeocode(pos.lat, pos.lng);
          address = ` (${rev.road ? rev.road + ', ' : ''}${rev.city ? rev.city + ', ' : ''}${rev.country || ''})`;
        } catch (e) { logger.error('[location] Reverse geocode failed:', e); }
        return {
          success: true,
          content: `Location: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}${address}\nAccuracy: ${pos.accuracy ? `${Math.round(pos.accuracy)}m` : 'unknown'}`
        };
      } catch (e: unknown) {
        return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
      }
    }
  },
  {
    id: 'search_places', name: 'search_places',
    description: 'Search for places, addresses, or landmarks using OpenStreetMap.',
    execute: async ({ query, limit = 5 }) => {
      try {
        const MapService = (await import('../MapService')).default;
        const places = await MapService.searchPlaces(query, limit);
        if (places.length === 0) return { success: true, content: 'No places found for that query.' };
        const lines = places.map((p, i) =>
          `${i + 1}. **${p.displayName.slice(0, 100)}** — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
        );
        return { success: true, content: `Found ${places.length} place(s):\n${lines.join('\n')}` };
      } catch (e: unknown) {
        return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
      }
    }
  },
  {
    id: 'show_map', name: 'show_map',
    description: 'Render an interactive OpenStreetMap. Provide center coords, markers, and optional route.',
    execute: async ({ center, markers, route, zoom = 13, title }) => {
      const mapData = { center, markers: markers || [], route: route || null, zoom, title: title || '' };
      const visualBlock = JSON.stringify({ type: 'map', data: mapData });
      const names = [title, center.label, center.name].filter(Boolean);
      const placeDesc = names.length > 0 ? names.join(' — ') : `${center.lat?.toFixed(4)}, ${center.lng?.toFixed(4)}`;
      const markerCount = (markers?.length || 0);
      const desc = `A map titled "${title || 'Map'}" was rendered centered on ${placeDesc} at zoom ${zoom}${markerCount > 0 ? ` with ${markerCount} marker(s)` : ''}.`;
      return { success: true, content: `${desc}\n\`\`\`visual\n${visualBlock}\n\`\`\`` };
    }
  }
];
