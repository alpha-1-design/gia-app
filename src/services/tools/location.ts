import { logger } from '../../utils/logger';
import type { Tool } from './types';

interface OSRMRoute {
  legs: { steps: { instruction: string; distance: number; duration: number; maneuver: { type: string; location: number[] } }[]; distance: number; duration: number; summary: string }[];
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
}

async function getCoordsFromQuery(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const MapService = (await import('../MapService')).default;
  const places = await MapService.searchPlaces(query, 1);
  if (places.length === 0) return null;
  return { lat: places[0].lat, lng: places[0].lng, label: places[0].displayName.slice(0, 80) };
}

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
        const places = await MapService.searchPlaces(query as string, limit as number);
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
      const names = [title as string, (center as Record<string, string>).label, (center as Record<string, string>).name].filter(Boolean);
      const placeDesc = names.length > 0 ? names.join(' — ') : `${(center as Record<string, number>).lat?.toFixed(4)}, ${(center as Record<string, number>).lng?.toFixed(4)}`;
      const markerCount = ((markers as unknown[])?.length || 0);
      const desc = `A map titled "${title || 'Map'}" was rendered centered on ${placeDesc} at zoom ${zoom}${markerCount > 0 ? ` with ${markerCount} marker(s)` : ''}.`;
      return { success: true, content: `${desc}\n\`\`\`visual\n${visualBlock}\n\`\`\`` };
    }
  },
  {
    id: 'get_directions', name: 'get_directions',
    description: 'Get turn-by-turn directions and route between two places. Returns distance, duration, and a route that can be displayed on a map with show_map.',
    execute: async ({ origin, destination, mode = 'driving' }) => {
      try {
        const resolveOrigin = typeof origin === 'string'
          ? await getCoordsFromQuery(origin as string)
          : { lat: (origin as Record<string, number>).lat, lng: (origin as Record<string, number>).lng, label: 'Origin' };
        if (!resolveOrigin) return { success: false, content: '', error: `Could not find origin: ${origin}` };
        const resolveDest = typeof destination === 'string'
          ? await getCoordsFromQuery(destination as string)
          : { lat: (destination as Record<string, number>).lat, lng: (destination as Record<string, number>).lng, label: 'Destination' };
        if (!resolveDest) return { success: false, content: '', error: `Could not find destination: ${destination}` };
        const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'cycling' : 'driving';
        const url = `https://router.project-osrm.org/route/v1/${profile}/${resolveOrigin.lng},${resolveOrigin.lat};${resolveDest.lng},${resolveDest.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`OSRM error: ${res.status}`);
        const data = await res.json() as { code: string; routes: OSRMRoute[] };
        if (!data.routes?.length) return { success: false, content: '', error: 'No route found between these locations.' };
        const route = data.routes[0];
        const routeCoords = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
        const distKm = route.distance / 1000;
        const durationMin = Math.round(route.duration / 60);
        const steps = route.legs[0]?.steps || [];
        const instructions = steps.map((s, i) =>
          `${i + 1}. ${s.instruction} (${(s.distance / 1000).toFixed(1)} km, ${Math.round(s.duration / 60)} min)`
        );
        const center = {
          lat: (resolveOrigin.lat + resolveDest.lat) / 2,
          lng: (resolveOrigin.lng + resolveDest.lng) / 2,
        };
        const mapVisual = JSON.stringify({
          type: 'map',
          data: {
            center,
            markers: [
              { lat: resolveOrigin.lat, lng: resolveOrigin.lng, label: resolveOrigin.label || 'Start', color: '#22c55e' },
              { lat: resolveDest.lat, lng: resolveDest.lng, label: resolveDest.label || 'End', color: '#ef4444' },
            ],
            route: routeCoords,
            zoom: 10,
            title: `${resolveOrigin.label?.split(',')[0] || 'Start'} → ${resolveDest.label?.split(',')[0] || 'End'}`,
          }
        });
        const summary = `## Route: ${resolveOrigin.label || 'Start'} → ${resolveDest.label || 'End'}
**Distance:** ${distKm.toFixed(1)} km
**Duration:** ${durationMin} min
**Mode:** ${mode}
**Route summary:** ${route.legs[0]?.summary || ''}

### Turn-by-turn instructions
${instructions.join('\n')}

\`\`\`visual
${mapVisual}
\`\`\``;
        return { success: true, content: summary };
      } catch (e: unknown) {
        return { success: false, content: '', error: (e instanceof Error ? e.message : String(e)) };
      }
    }
  }
];
