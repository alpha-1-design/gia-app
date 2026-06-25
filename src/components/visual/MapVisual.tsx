import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { VisualHeader } from './common';
import { useCopy } from './useCopy';

// Static import of Leaflet CSS — dynamic import of CSS does NOT work reliably
// in Capacitor Android WebView. This must be a static import.
import 'leaflet/dist/leaflet.css';

interface MapData {
  center?: { lat: number; lng: number };
  markers?: { lat: number; lng: number; label?: string; color?: string }[];
  route?: { lat: number; lng: number }[];
  zoom?: number;
  title?: string;
}

export const MapVisual: React.FC<{ data: Record<string, unknown> }> = ({ data }) => {
  const [copied, copy] = useCopy();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<{ remove: () => void; invalidateSize: () => void } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mapData = data as MapData;
  const center = mapData.center || { lat: 0, lng: 0 };
  const markers = useMemo(() => mapData.markers || [], [mapData.markers]);
  const route = useMemo(() => mapData.route || [], [mapData.route]);
  const zoom = mapData.zoom ?? 13;
  const title = mapData.title || '';

  const markersKey = JSON.stringify(markers);
  const routeKey = JSON.stringify(route);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const el = mapRef.current;
    setLoading(true);
    setMapError(null);

    const initMap = async () => {
      try {
        // Dynamic import of the Leaflet module only (NOT the CSS — that's static above)
        const L = await import('leaflet');

        // Fix default icon paths broken by bundlers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const isDark = document.documentElement.classList.contains('dark');
        const tileUrl = isDark
          ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const attribution = isDark
          ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        const map = L.map(el, {
          center: [center.lat, center.lng],
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);

        markers.forEach((m) => {
          const color = m.color || '#a855f7';
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
          if (m.label) marker.bindPopup(`<b style="font-size:12px">${m.label}</b>`);
        });

        if (route.length >= 2) {
          const coords = route.map((p) => [p.lat, p.lng] as [number, number]);
          L.polyline(coords, { color: '#a855f7', weight: 4, opacity: 0.85 }).addTo(map);
          map.fitBounds(L.latLngBounds(coords), { padding: [20, 20] });
        } else if (markers.length > 1) {
          const bounds = markers.map((m) => [m.lat, m.lng] as [number, number]);
          map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
        }

        mapInstance.current = map;
        setLoading(false);

        // invalidateSize must run after the DOM has actually painted
        requestAnimationFrame(() => {
          setTimeout(() => {
            map.invalidateSize({ animate: false });
          }, 150);
        });
      } catch (err) {
        console.error('[MapVisual] Failed to init map:', err);
        setMapError('Failed to load map. Check your internet connection.');
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, zoom, markersKey, routeKey]);

  // When expanded state changes, the container resizes — tell Leaflet
  useEffect(() => {
    if (mapInstance.current) {
      requestAnimationFrame(() => {
        setTimeout(() => mapInstance.current?.invalidateSize(), 100);
      });
    }
  }, [expanded]);

  const copyData = useCallback(() => {
    copy(JSON.stringify({ type: 'map', data }, null, 2));
  }, [data, copy]);

  const height = expanded ? 420 : 240;

  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)' }}>
      <VisualHeader
        title={title || 'Map'}
        onCopy={copyData}
        copied={copied}
        onExpand={() => setExpanded(e => !e)}
        expanded={expanded}
      />
      <div style={{ position: 'relative', width: '100%', height: `${height}px`, background: '#1a1a2e' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--gia-muted)', fontSize: '12px', zIndex: 10,
          }}>
            Loading map…
          </div>
        )}
        {mapError && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#f87171', fontSize: '12px', padding: '16px',
            textAlign: 'center', zIndex: 10,
          }}>
            ⚠️ {mapError}
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
