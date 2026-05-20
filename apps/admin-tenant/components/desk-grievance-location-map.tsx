'use client';

import { useEffect, useRef } from 'react';

import { createGrievanceMapPinIcon } from '../lib/leaflet-map-pin';

const DEFAULT_ZOOM = 15;

type DeskGrievanceLocationMapProps = {
  latitude: number;
  longitude: number;
};

/** Read-only map pin for Tenant Desk grievance detail. */
export function DeskGrievanceLocationMap({
  latitude,
  longitude,
}: DeskGrievanceLocationMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) {
        return;
      }

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markerRef.current = L.marker([latitude, longitude], {
        icon: createGrievanceMapPinIcon(L),
      }).addTo(map);
      map.setView([latitude, longitude], DEFAULT_ZOOM);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per grievance selection
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    void import('leaflet').then((L) => {
      if (!mapRef.current) {
        return;
      }
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude], {
          icon: createGrievanceMapPinIcon(L),
        }).addTo(mapRef.current);
      }
      mapRef.current.setView([latitude, longitude], DEFAULT_ZOOM);
    });
  }, [latitude, longitude]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-2xl border border-warm-border shadow-inner"
        aria-label="Grievance location map"
      />
      <p className="text-xs text-ink-secondary">
        WGS-84 pin: {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>
    </div>
  );
}
