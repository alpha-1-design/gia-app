export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface Place {
  lat: number;
  lng: number;
  displayName: string;
  type: string;
  importance: number;
  osmId?: string;
  osmType?: string;
}

export interface ReverseGeoResult {
  displayName: string;
  road?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

class MapService {
  async getCurrentPosition(): Promise<GeoPosition> {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
        altitude: pos.coords.altitude ?? undefined,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
      };
    } catch {
      // Fallback to browser Geolocation API
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not available on this device.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
            altitude: pos.coords.altitude ?? undefined,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
          }),
          (err) => reject(new Error(`Geolocation error: ${err.message}`)),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  async searchPlaces(query: string, limit = 5): Promise<Place[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(limit),
      addressdetails: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'GIA/3.0 (Alpha-1 Studio, Ghana)' },
    });
    if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);
    const data: any[] = await res.json();
    return data.map((p) => ({
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
      displayName: p.display_name,
      type: p.type || 'unknown',
      importance: p.importance || 0,
      osmId: p.osm_id,
      osmType: p.osm_type,
    }));
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': 'GIA/3.0 (Alpha-1 Studio, Ghana)' },
    });
    if (!res.ok) throw new Error(`Reverse geocoding error: ${res.status}`);
    const data: any = await res.json();
    const addr = data.address || {};
    return {
      displayName: data.display_name || '',
      road: addr.road || addr.pedestrian || '',
      city: addr.city || addr.town || addr.village || addr.municipality || '',
      state: addr.state || '',
      country: addr.country || '',
      postcode: addr.postcode || '',
    };
  }
}

export default new MapService();
