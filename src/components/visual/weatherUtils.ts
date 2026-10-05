export type WeatherCondition =
  | 'sunny' | 'clear-night' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

const ALIASES: Record<string, WeatherCondition> = {
  sunny: 'sunny', sun: 'sunny', clear: 'sunny', 'mostly sunny': 'sunny',
  'clear-night': 'clear-night', night: 'clear-night', 'clear night': 'clear-night',
  'partly-cloudy': 'partly-cloudy', 'partly cloudy': 'partly-cloudy', 'mostly cloudy': 'partly-cloudy', 'few clouds': 'partly-cloudy',
  cloudy: 'cloudy', overcast: 'cloudy', clouds: 'cloudy',
  rain: 'rain', rainy: 'rain', showers: 'rain', drizzle: 'rain', 'light rain': 'rain', 'heavy rain': 'rain',
  storm: 'storm', thunderstorm: 'storm', thunder: 'storm', stormy: 'storm',
  snow: 'snow', snowy: 'snow', sleet: 'snow', hail: 'snow',
  fog: 'fog', foggy: 'fog', mist: 'fog', haze: 'fog', hazy: 'fog',
};

export function normalizeCondition(raw: unknown): WeatherCondition {
  const key = String(raw ?? '').trim().toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  if (key.includes('thunder') || key.includes('storm')) return 'storm';
  if (key.includes('rain') || key.includes('shower') || key.includes('drizzle')) return 'rain';
  if (key.includes('snow') || key.includes('sleet')) return 'snow';
  if (key.includes('fog') || key.includes('mist') || key.includes('haze')) return 'fog';
  if (key.includes('partly') || key.includes('few')) return 'partly-cloudy';
  if (key.includes('cloud') || key.includes('overcast')) return 'cloudy';
  return 'sunny';
}

export interface AqiBand { label: string; color: string }

/** US EPA AQI bands. */
export function aqiBand(aqi: number): AqiBand {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#a855f7' };
  return { label: 'Hazardous', color: '#9f1239' };
}

export function formatTemp(value: unknown, unit: string): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}°${unit}`;
}
