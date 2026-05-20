'use client';

import { useEffect, useRef } from 'react';

import { createGrievanceMapPinIcon } from '../lib/leaflet-map-pin';

/** Kolkata — sensible default for KMC/WB demos. */
const DEFAULT_CENTER = { lat: 22.5726, lng: 88.3639 };
const DEFAULT_ZOOM = 13;

type GrievanceLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  onPinChange: (lat: number, lng: number) => void;
  onError?: (message: string) => void;
};

export function GrievanceLocationMap({
  latitude,
  longitude,
  onPinChange,
  onError,
}: GrievanceLocationMapProps): JSX.Element {
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
        center: [latitude ?? DEFAULT_CENTER.lat, longitude ?? DEFAULT_CENTER.lng],
        zoom: DEFAULT_ZOOM,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const setPin = (lat: number, lng: number): void => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: createGrievanceMapPinIcon(L) }).addTo(
            map,
          );
        }
        onPinChange(lat, lng);
      };

      map.on('click', (event) => {
        setPin(event.latlng.lat, event.latlng.lng);
      });

      if (latitude !== null && longitude !== null) {
        markerRef.current = L.marker([latitude, longitude], {
          icon: createGrievanceMapPinIcon(L),
        }).addTo(map);
        map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map mounts once; pin sync handled below
  }, []);

  useEffect(() => {
    if (!mapRef.current || latitude === null || longitude === null) {
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
      mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 15));
    });
  }, [latitude, longitude]);

  function useMyLocation(): void {
    if (!navigator.geolocation) {
      onError?.('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onPinChange(lat, lng);
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 16);
        }
      },
      () => {
        onError?.('Could not read GPS location. Tap the map to place a pin instead.');
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-52 w-full overflow-hidden rounded-2xl border border-slate-200 shadow-inner"
        aria-label="Map to choose grievance location"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <p>Tap the map to drop a pin, or use your current location.</p>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-brand"
          onClick={useMyLocation}
        >
          Use my location
        </button>
      </div>
      {latitude !== null && longitude !== null ? (
        <p className="text-xs text-slate-700">
          Pin: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-slate-500">No pin placed yet.</p>
      )}
    </div>
  );
}
