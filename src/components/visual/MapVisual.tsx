import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { VisualHeader } from './common';
import { useCopy } from './useCopy';

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
  const mapInstance = useRef<{ remove: () => void } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const mapData = data as MapData;
  const center = mapData.center || { lat: 0, lng: 0 };
  const markers = useMemo(() => mapData.markers || [], [mapData.markers]);
  const route = useMemo(() => mapData.route || [], [mapData.route]);
  const zoom = mapData.zoom ?? 13;
  const title = mapData.title || '';

  const markersStr = JSON.stringify(markers);
  const routeStr = JSON.stringify(route);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const el = mapRef.current;
    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      const isDark = document.documentElement.classList.contains('dark');
      const tileUrl = isDark
        ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attribution = isDark
        ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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
          className: 'custom-marker',
          html: `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        if (m.label) marker.bindPopup(m.label);
      });

      if (route.length >= 2) {
        const coords = route.map((p) => [p.lat, p.lng] as [number, number]);
        L.polyline(coords, { color: '#a855f7', weight: 3, opacity: 0.8 }).addTo(map);
        map.fitBounds(L.latLngBounds(coords));
      } else if (markers.length > 1) {
        const bounds = markers.map((m) => [m.lat, m.lng] as [number, number]);
        map.fitBounds(L.latLngBounds(bounds));
      }

      mapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    };
    initMap();
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [center.lat, center.lng, zoom, markers, route, markersStr, routeStr]);

  const copyData = useCallback(() => {
    copy(JSON.stringify({ type: 'map', data }, null, 2));
  }, [data, copy]);

  const height = expanded ? 400 : 220;

  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--gia-border)' }}>
      <VisualHeader title={title || 'OpenStreetMap'} onCopy={copyData} copied={copied} onExpand={() => setExpanded(e => !e)} expanded={expanded} />
      <div ref={mapRef} style={{ width: '100%', height: `${height}px`, background: '#1a1a2e' }} />
    </div>
  );
};
