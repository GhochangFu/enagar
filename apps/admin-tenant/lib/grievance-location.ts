export function parseGrievanceLocationPin(location: unknown): { lat: number; lng: number } | null {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return null;
  }
  const record = location as Record<string, unknown>;
  const latRaw = record.latitude;
  const lngRaw = record.longitude;
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

export function locationSummaryWithoutCoords(location: unknown): Record<string, unknown> | null {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return null;
  }
  const { latitude: _lat, longitude: _lng, ...rest } = location as Record<string, unknown>;
  return Object.keys(rest).length ? rest : null;
}
